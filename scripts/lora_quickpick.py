
import os, json, shutil
from typing import List
from fastapi import FastAPI
import gradio as gr
from modules import script_callbacks, shared

# --- LoRA QuickPick: filter out ONLY asyncio WinError 10054 noise (robust) ---
import logging as _lqp_logging
def _lqp_is_10054(record):
    try:
        # 1) Check exception info carried by the log record
        exc_info = getattr(record, "exc_info", None)
        if exc_info and isinstance(exc_info, tuple):
            _etype, _e, _tb = exc_info
            if isinstance(_e, ConnectionResetError) or getattr(_e, "winerror", None) == 10054:
                return True
        # 2) Check formatted message text for Proactor callback and code 10054
        msg = record.getMessage() if hasattr(record, "getMessage") else str(getattr(record, "msg", ""))
        if "_ProactorBasePipeTransport._call_connection_lost" in msg and "10054" in msg:
            return True
    except Exception:
        pass
    return False

class _LQPAsyncio10054Filter(_lqp_logging.Filter):
    def filter(self, record):
        try:
            # Only target asyncio logger at ERROR level spam from Windows Proactor
            if str(getattr(record, "name", "")).startswith("asyncio") and getattr(record, "levelno", 0) >= _lqp_logging.ERROR:
                if _lqp_is_10054(record):
                    return False  # drop just this benign noise
        except Exception:
            pass
        return True

_lqp_logging.getLogger("asyncio").addFilter(_LQPAsyncio10054Filter())
# --- /end minimal filter ---


EXTS = ('.safetensors', '.pt', '.ckpt', '.bin')
CANDIDATE_DIRNAMES = ['Lora','LoRA','LORAs','Loras','loras','lora']

def _split_paths(raw: str):
    if not raw: return []
    seps = [';']
    if os.name != 'nt': seps.append(':')
    arr = [raw]
    for s in seps:
        tmp = []
        for p in arr: tmp.extend(p.split(s))
        arr = tmp
    out = []
    for p in arr:
        p = p.strip().strip('"')
        if p: out.append(os.path.abspath(os.path.expanduser(p)))
    return out

def _append(paths: list, path: str, seen: set):
    if not path: return
    try:
        ap = os.path.abspath(path)
        if os.path.isdir(ap) and ap not in seen:
            seen.add(ap); paths.append(ap)
    except: pass

def _get_lora_roots():
    """
    Return a single logical root for LoRA files.
    Preference order:
    1) Explicit lora_dir option (settings).
    2) --lora-dir from cmd opts.
    3) LORA_DIR / LORAS_DIR env vars.
    4) First existing autodetected models/... candidate.
    5) First existing cwd/models/... candidate.
    """
    # 1) shared opts: lora_dir
    try:
        ldir = getattr(shared.opts, 'lora_dir', None)
        if ldir:
            for p in _split_paths(ldir):
                ap = os.path.abspath(p)
                if os.path.isdir(ap):
                    return [ap]
    except:
        pass

    # 2) cmd opts: --lora-dir or args.lora_dir
    try:
        args = getattr(shared, 'cmd_opts', None)
        # legacy: argv-like list / tuple
        if isinstance(args, (list, tuple)):
            for i, a in enumerate(args):
                if a == '--lora-dir' and i + 1 < len(args):
                    for p in _split_paths(args[i+1]):
                        ap = os.path.abspath(p)
                        if os.path.isdir(ap):
                            return [ap]
        else:
            val = getattr(args, 'lora_dir', None)
            if val:
                for p in _split_paths(val):
                    ap = os.path.abspath(p)
                    if os.path.isdir(ap):
                        return [ap]
    except:
        pass

    # 3) environment variables
    for key in ('LORA_DIR', 'LORAS_DIR'):
        raw = os.environ.get(key, '') or ''
        for p in _split_paths(raw):
            ap = os.path.abspath(p)
            if os.path.isdir(ap):
                return [ap]

    # 4) autodetect under models_path / model_path
    try:
        base = getattr(shared, 'models_path', None) or getattr(shared, 'model_path', None)
        if base:
            for d in CANDIDATE_DIRNAMES:
                ap = os.path.abspath(os.path.join(base, d))
                if os.path.isdir(ap):
                    return [ap]
    except:
        pass

    # 5) fallback: cwd/models/...
    here = os.getcwd()
    for d in CANDIDATE_DIRNAMES:
        ap = os.path.abspath(os.path.join(here, 'models', d))
        if os.path.isdir(ap):
            return [ap]

    return []


def _inode(path):
    try:
        st = os.stat(path, follow_symlinks=True)
        return (getattr(st,'st_dev',0), getattr(st,'st_ino',0))
    except:
        return (0, hash(os.path.realpath(path)) & 0xFFFFFFFF)

def _normalize_words(raw):
    if raw is None: return []
    if isinstance(raw, list):
        out = []
        for x in raw:
            s = str(x).strip()
            if not s: continue
            parts = [p.strip() for p in s.split(',')] if ',' in s else [s]
            out.extend([p for p in parts if p])
        return out
    s = str(raw).strip()
    if not s: return []
    s = s.splitlines()[0].strip()
    parts = [p.strip() for p in (s.split(',') if ',' in s else s.split())]
    return [p for p in parts if p]

def _load_triggers_from_json(p):
    try:
        with open(p,'r',encoding='utf-8') as f: data = json.load(f)
        for k in ('activation text','activation_text','activation','trigger','trigger_words','trainedWords','triggerWords'):
            if k in data: 
                return _normalize_words(data[k]), float(data.get('preferred weight', data.get('preferred_weight', 0)) or 0)
        for k in ('description','notes'):
            if k in data:
                words = _normalize_words(data[k])
                if words: return words, float(data.get('preferred weight', data.get('preferred_weight', 0)) or 0)
    except: pass
    return [], 0.0

def _load_sidecars(dirp, filep):
    name, ext = os.path.splitext(filep)
    base = os.path.join(dirp, name)
    cands = [base+'.json', base+f'_{ext.lstrip(".").lower()}.json', base+f'-{ext.lstrip(".").lower()}.json']
    civ = base+'.civitai.info'
    txt = base+'.txt'
    trig, pref = [], 0.0
    for p in cands:
        if os.path.isfile(p):
            tt, pw = _load_triggers_from_json(p)
            if tt: trig = tt
            if pw: pref = pw
            break
    if not trig and os.path.isfile(civ):
        try:
            with open(civ,'r',encoding='utf-8') as f: data = json.load(f)
            for k in ('trainedWords','triggerWords'):
                if isinstance(data.get(k), list):
                    trig = [str(x).strip() for x in data[k] if str(x).strip()]
                    break
        except: pass
    if not trig and os.path.isfile(txt):
        try:
            raw = open(txt,'r',encoding='utf-8',errors='ignore').read().strip()
            if raw:
                line = raw.splitlines()[0].strip()
                trig = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
        except: pass
    return trig, pref

def _scan_root(root):
    folders, trig_map, w_map, seen = {}, {}, {}, set()
    for cur, dirs, files in os.walk(root, followlinks=True):
        key = _inode(cur)
        if key in seen:
            dirs[:] = []
            continue
        seen.add(key)
        rel = os.path.relpath(cur, root)
        rel = '' if rel == '.' else rel.replace('\\','/')
        for f in files:
            fl = f.lower()
            if any(fl.endswith(e) for e in EXTS):
                name = os.path.splitext(f)[0]
                folders.setdefault(rel, []).append(name)
                t, pw = _load_sidecars(cur, f)
                if t: trig_map[name] = t
                if pw: w_map[name] = pw
    for k in list(folders.keys()): folders[k].sort(key=lambda s: s.lower())
    return folders, trig_map, w_map

def _merge():
    roots = _get_lora_roots()
    out_folders, out_trig, out_w = {}, {}, {}
    need_prefix = len(roots) > 1
    for base in roots:
        folders, trig, wmap = _scan_root(base)
        tag = os.path.basename(base) or os.path.basename(os.path.dirname(base))
        for sub, names in folders.items():
            key = f'[{tag}]/{sub}' if (need_prefix and sub) else (f'[{tag}]' if need_prefix else sub)
            out_folders.setdefault(key, []).extend(names)
        for k,v in trig.items(): out_trig[k] = v
        for k,v in wmap.items(): out_w[k] = v
    return out_folders, out_trig, out_w


def _folder_for_key(key: str):
    """Resolve a displayed folder key, including a directory symlink inside a LoRA root."""
    rel = (key or '').replace('\\', '/').strip('/')
    tag = None
    if rel.startswith('['):
        try:
            end = rel.index(']')
            tag = rel[1:end]
            rel = rel[end + 1:].strip('/')
        except ValueError:
            return None
    if any(part in ('', '.', '..') for part in rel.split('/') if rel) or '..' in rel:
        return None

    for base in _get_lora_roots():
        base_tag = os.path.basename(base) or os.path.basename(os.path.dirname(base))
        if tag and tag != base_tag:
            continue
        # Check the lexical path, not realpath(). A directory symlink located
        # under the configured LoRA root may intentionally point to an external
        # training-output folder. Dot segments have already been rejected above.
        root = os.path.abspath(base)
        folder = os.path.abspath(os.path.join(root, *rel.split('/'))) if rel else root
        try:
            if os.path.commonpath([root, folder]) != root or not os.path.isdir(folder):
                continue
        except ValueError:
            continue
        return folder
    return None

def _lora_file_for_delete(key: str, name: str):
    """Resolve one QuickPick item to a model file, without allowing path traversal."""
    stem = (name or '').strip()
    if not stem or stem != os.path.basename(stem) or os.path.splitext(stem)[1]:
        return None

    folder = _folder_for_key(key)
    if not folder:
        return None
    try:
        for filename in os.listdir(folder):
            candidate_stem, ext = os.path.splitext(filename)
            if candidate_stem == stem and ext.lower() in EXTS:
                return folder, os.path.join(folder, filename)
    except OSError:
        return None
    return None

def _associated_lora_files(model_path: str):
    """Return only the model and its recognised preview/metadata sidecars."""
    model_stem, model_ext = os.path.splitext(model_path)
    targets = [model_path]
    for suffix in ('', '.preview'):
        for ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm'):
            sidecar = model_stem + suffix + ext
            if os.path.isfile(sidecar):
                targets.append(sidecar)
    for sidecar in (
        model_stem + '.json',
        model_stem + '_' + model_ext.lstrip('.').lower() + '.json',
        model_stem + '-' + model_ext.lstrip('.').lower() + '.json',
    ):
        if os.path.isfile(sidecar):
            targets.append(sidecar)
    return targets


def _register(app: FastAPI):
    @app.get('/lora-quickpick/list')
    def list_api():
        f,_,_ = _merge(); return f

    @app.get('/lora-quickpick/triggers')
    def trig_api():
        _,t,_ = _merge(); return t

    @app.get('/lora-quickpick/prefweights')
    def w_api():
        try:
            _,_,w = _merge()
            return w or {}
        except Exception:
            return {}

    @app.post('/lora-quickpick/delete')
    def delete_api(key: str = "", name: str = ""):
        from fastapi import HTTPException

        resolved = _lora_file_for_delete(key, name)
        if not resolved:
            raise HTTPException(status_code=404, detail="LoRA not found")

        _, model_path = resolved
        # Only the model and its directly associated QuickPick/Forge sidecars
        # are in scope. Directories and unrelated files are never removed.
        targets = _associated_lora_files(model_path)

        deleted = []
        try:
            for path in targets:
                os.remove(path)
                deleted.append(os.path.basename(path))
        except OSError as err:
            raise HTTPException(status_code=500, detail=f"Could not delete LoRA: {err}")
        return {"deleted": deleted}

    @app.post('/lora-quickpick/move')
    def move_api(key: str = "", name: str = "", destination: str = ""):
        from fastapi import HTTPException

        resolved = _lora_file_for_delete(key, name)
        destination_folder = _folder_for_key(destination)
        if not resolved:
            raise HTTPException(status_code=404, detail="LoRA not found")
        if not destination_folder:
            raise HTTPException(status_code=404, detail="Destination folder not found")

        source_folder, model_path = resolved
        if os.path.normcase(os.path.realpath(source_folder)) == os.path.normcase(os.path.realpath(destination_folder)):
            return {"moved": []}

        files = _associated_lora_files(model_path)
        moves = [(path, os.path.join(destination_folder, os.path.basename(path))) for path in files]
        conflicts = [os.path.basename(target) for _, target in moves if os.path.exists(target)]
        if conflicts:
            raise HTTPException(status_code=409, detail=f"Destination already contains: {', '.join(conflicts)}")

        moved = []
        try:
            for source, target in moves:
                shutil.move(source, target)
                moved.append(os.path.basename(target))
        except OSError as err:
            raise HTTPException(status_code=500, detail=f"Could not move LoRA: {err}")
        return {"moved": moved}

    @app.get('/lora-quickpick/preview')
    def preview_api(key: str = "", name: str = "", ext: str = "png"):
        from fastapi.responses import FileResponse
        from fastapi import Response
        ext = (ext or "").lower()
        if not name or ext not in {'png','jpg','jpeg','webp'}:
            return Response(status_code=400)
        roots = _get_lora_roots()
        rel = key or ""
        tag = None
        if rel.startswith('['):
            try:
                end = rel.index(']')
                tag = rel[1:end]
                rel = rel[end+1:].lstrip('/')
            except ValueError:
                pass
        rel = rel.replace('..','').strip('/').replace('\\','/')
        def try_send(p):
            if os.path.exists(p):
                return FileResponse(p, headers={'Cache-Control':'public, max-age=604800'})
            return None
        def name_variants(stem):
            yield stem
            yield stem.replace(' ', '_')
            yield stem.replace('_', ' ')
        if rel:
            for base in _get_lora_roots():
                base_tag = os.path.basename(base) or os.path.basename(os.path.dirname(base))
                if tag and base_tag != tag:
                    continue
                for nm in name_variants(name):
                    cand = os.path.join(base, rel, f"{nm}.{ext}")
                    hit = try_send(cand)
                    if hit: return hit
                    for alt in (f"{nm}.{ext}".lower(), f"{nm}.{ext}".upper()):
                        hit = try_send(os.path.join(base, rel, alt))
                        if hit: return hit
        image_exts = {'.png', '.jpg', '.jpeg', '.webp'}
        for base in _get_lora_roots():
            base_depth = base.count(os.sep)
            for cur, _, files in os.walk(base, followlinks=True):
                if cur.count(os.sep) - base_depth > 6:
                    continue
                for nm in name_variants(name):
                    for f in files:
                        stem, file_ext = os.path.splitext(f)
                        if stem.lower() == nm.lower() and file_ext.lower() in image_exts:
                            p1 = os.path.join(cur, f"{nm}.{ext}")
                            return FileResponse(
                                p1 if os.path.exists(p1) else os.path.join(cur, f),
                                headers={'Cache-Control':'public, max-age=604800'}
                            )
        return Response(status_code=404)
def on_app_started(_: gr.Blocks, app: FastAPI):
    _register(app)

if hasattr(script_callbacks,'on_app_started'):
    script_callbacks.on_app_started(on_app_started)
elif hasattr(script_callbacks,'app_started_callback'):
    script_callbacks.app_started_callback(on_app_started)
