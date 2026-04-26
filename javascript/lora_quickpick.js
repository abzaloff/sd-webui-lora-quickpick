(function () {
  const EXT_ID = "lora-quickpick";
  const EXT_ID_IMG2IMG = "lora-quickpick-img2img";
  window._lqpGetSelected = window._lqpGetSelected || {};
  const WEIGHT_MIN = -4.0, WEIGHT_MAX = 4.0;
  const app = () => gradioApp();
  const qs = (sel, root = app()) => root.querySelector(sel);
  const qsa = (sel, root = app()) => root.querySelectorAll(sel);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const State = { folders: {}, triggers: {}, prefs: {} };
  window._lqpState = State;
  const LS_KEYS = { favorites:"lqp-favorites", presets:"lqp-presets", lastFolder:"lqp-last-folder", searchAll:"lqp-scope-all" };

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "style") Object.assign(e.style, v);
      else if (k === "dataset") Object.entries(v).forEach(([dk, dv]) => e.dataset[dk] = dv);
      else e.setAttribute(k, v);
    });
    for (const c of children) if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
  }

  function ensureStyles() {
    if (document.getElementById("lqp-style")) return;
    const style = document.createElement("style"); style.id = "lqp-style";
    style.textContent = `
      #${EXT_ID}{
        --lqp-bg: var(--input-background-fill, var(--background-fill-secondary, #1f1f1f));
        --lqp-surface: var(--block-background-fill, var(--background-fill-primary, #141414));
        --lqp-text: var(--body-text-color, #ddd);
        --lqp-border: var(--border-color, var(--input-border-color, #444));
        --lqp-hover: rgba(255,255,255,.06);
        --lqp-hover: color-mix(in srgb, var(--lqp-text) 10%, transparent);
        --lqp-active: rgba(255,255,255,.1);
        --lqp-active: color-mix(in srgb, var(--lqp-text) 18%, transparent);
        --lqp-shadow: rgba(0,0,0,.35);
        --lqp-shadow: color-mix(in srgb, var(--lqp-text) 32%, transparent);
        --lqp-overlay: rgba(0,0,0,.45);
        --lqp-overlay: color-mix(in srgb, var(--lqp-bg) 58%, transparent);
        --lqp-overlay-strong: rgba(0,0,0,.6);
        --lqp-overlay-strong: color-mix(in srgb, var(--lqp-bg) 72%, transparent);
        grid-column:1 / -1 !important; width:100%; margin:.5rem 0 0 0; position:relative; display:block;
      }
      #${EXT_ID} .lqp-label{ font-size:.9rem; opacity:.85; margin:0 0 .25rem; }
      #${EXT_ID} .lqp-box{
        --lqp-actions-pad: 8px;
        position: relative;
        min-height:38px; display:flex; flex-wrap:wrap; gap:.35rem; align-items:center;
        padding:.35rem .6rem .35rem .6rem;
        padding-right: var(--lqp-actions-pad);
        border:1px solid var(--lqp-border); border-radius:.65rem;
        background: var(--lqp-bg); color: var(--lqp-text); cursor:text;
      }
      #${EXT_ID} .lqp-placeholder{ opacity:.6; }
      #${EXT_ID} .lqp-chip{ display:inline-flex; align-items:center; gap:.35rem; padding:.25rem .55rem; border:1px solid var(--lqp-border); border-radius:.75rem; background: var(--lqp-surface); }
      #${EXT_ID} .lqp-chip.off{ opacity:.45; filter:grayscale(.6); }
      #${EXT_ID} .lqp-w{ user-select:none; cursor:ew-resize; padding:0 .35rem; border:1px dashed var(--lqp-border); border-radius:.35rem; background: var(--lqp-bg); }
      #${EXT_ID} .lqp-x{ line-height:1; padding:0 .4rem; }
      #${EXT_ID} .lqp-spacer{ flex:1 1 auto; min-width:24px; }
      #${EXT_ID} .lqp-btn{ margin-left:.35rem; border:1px solid var(--lqp-border); border-radius:.55rem; background: var(--lqp-surface); color: var(--lqp-text); padding:.2rem .5rem; cursor:pointer; }
      /* Sticky action bar (top-right) */
      #${EXT_ID} .lqp-actions{
        position:absolute; top:6px; right:8px; display:flex; gap:.35rem; align-items:center; z-index:2;
        background: transparent;
      }
      #${EXT_ID} .lqp-menu{ position:absolute; z-index:1000; left:0; right:auto; top: calc(100% + 6px); border:1px solid var(--lqp-border); border-radius:.65rem; background: var(--lqp-bg); display:flex; max-height:360px; overflow:hidden; box-shadow: 0 10px 28px var(--lqp-shadow); }
      #${EXT_ID} .lqp-left{ width:260px; border-right:1px solid var(--lqp-border); overflow:auto; background: var(--lqp-bg); }
      #${EXT_ID} .lqp-right{ flex:1 1 auto; display:flex; flex-direction:column; background: var(--lqp-bg); }
      #${EXT_ID} .lqp-top{ display:flex; gap:.4rem; padding:.4rem; border-bottom:1px solid var(--lqp-border); align-items:center; background: var(--lqp-bg); }
      #${EXT_ID} .lqp-search{ flex:1 1 auto; padding:.35rem .6rem; border:1px solid var(--lqp-border); border-radius:.5rem; background: var(--lqp-surface); color: var(--lqp-text); }
      #${EXT_ID} .lqp-all{ display:inline-flex; align-items:center; gap:.35rem; padding:.25rem .5rem; border:1px solid var(--lqp-border); border-radius:.5rem; background: var(--lqp-surface); }
      #${EXT_ID} .lqp-refresh{ padding:.35rem .6rem; border:1px solid var(--lqp-border); border-radius:.5rem; background: var(--lqp-surface); color: var(--lqp-text); cursor:pointer; }
      #${EXT_ID} .lqp-list{ overflow:auto; padding:.35rem; background: var(--lqp-bg); }
      #${EXT_ID} .lqp-item, #${EXT_ID} .lqp-folder{ display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left; padding:.55rem .8rem; background:transparent; border:0; color:var(--lqp-text); cursor:pointer; }
      #${EXT_ID} .lqp-item:hover, #${EXT_ID} .lqp-folder:hover{ background: var(--lqp-hover); }
      #${EXT_ID} .lqp-folder.active{ background: var(--lqp-active); }
      #${EXT_ID} .star{ margin-left:.6rem; cursor:pointer; opacity:.9; }
      /* Presets menu (solid) */
      #${EXT_ID} .lqp-preset-menu{ position:absolute; z-index:1001; right:0; top: calc(100% + 6px); min-width:240px; border:1px solid var(--lqp-border); border-radius:.65rem; background: var(--lqp-bg) !important; box-shadow: 0 10px 28px var(--lqp-shadow); overflow:hidden; }
      #${EXT_ID} .lqp-preset-menu .hdr{ display:flex; align-items:center; justify-content:space-between; padding:.4rem .6rem; border-bottom:1px solid var(--lqp-border); background: var(--lqp-bg) !important; }
      #${EXT_ID} .lqp-preset-menu .list{ max-height:320px; overflow:auto; padding:.25rem; background: var(--lqp-bg) !important; }
      #${EXT_ID} .lqp-preset-menu .row{ display:flex; align-items:center; justify-content:space-between; padding:.4rem .5rem; }
      #${EXT_ID} .lqp-preset-menu .row:hover{ background: var(--lqp-hover); }
      @media (max-width: 1200px){ #${EXT_ID} .lqp-left{ width:220px; } }
    `;
    document.head.appendChild(style);
    try{
      if(!document.getElementById('lqp-style-img2img')){
        const s2=document.createElement('style'); s2.id='lqp-style-img2img';
        s2.textContent = style.textContent.replaceAll('#'+EXT_ID, '#'+EXT_ID_IMG2IMG);
        document.head.appendChild(s2);
      }
    }catch(_){}
  }

  function readFavorites(){ try{ return JSON.parse(localStorage.getItem(LS_KEYS.favorites) || "[]"); }catch{ return []; } }
  function writeFavorites(arr){ localStorage.setItem(LS_KEYS.favorites, JSON.stringify(arr||[])); }

  // --- shared favorites for txt2img and img2img ---
  let FavoritesRef = null;
  function getFavorites(){
    if (!Array.isArray(FavoritesRef)) FavoritesRef = readFavorites();
    return FavoritesRef;
  }
  function syncFavorites(){
    writeFavorites(FavoritesRef || []);
  }
  // ---------------------------------------------

  function readPresets(){ try{ return JSON.parse(localStorage.getItem(LS_KEYS.presets) || "{}"); }catch{ return {}; } }
  function writePresets(obj){ localStorage.setItem(LS_KEYS.presets, JSON.stringify(obj||{})); }

  async function fetchJSON(url){ try{ const r = await fetch(url,{cache:"no-store"}); if(!r.ok) throw 0; return await r.json(); } catch{ return {}; } }

  function createUI(rootId = EXT_ID) {
    ensureStyles();
    const wrapper = el("div", { id: rootId });
    const tabForTheme = (rootId === EXT_ID_IMG2IMG) ? "img2img" : "txt2img";
    const label = el("div", { class: "lqp-label" }, "LoRA QuickPick");
    const box = el("div", { class: "lqp-box", tabindex: "0" });
    const placeholder = el("span", { class: "lqp-placeholder" }, "Click to select LoRA...");
    box.append(placeholder);
    wrapper.append(label, box);

    let menu = null;
    let presetMenu = null;
    const selected = new Map();
    let lastFolder = localStorage.getItem(LS_KEYS.lastFolder) || "";
    let favorites = getFavorites();
    let presets = readPresets();
    let dragName = null;
    let themeSyncRAF = 0;

    function syncThemeVars(){
      try{
        const ta = qs(`#${tabForTheme}_prompt textarea`) || qs(`#${tabForTheme}_neg_prompt textarea`) || qs("textarea");
        const genBtn = qs(`#${tabForTheme}_generate`) || qs("button");
        const panel = findPromptContainerFrom(ta) || findPromptContainerFrom(genBtn) || app();
        const sInput = getComputedStyle(ta || panel);
        const sBtn = getComputedStyle(genBtn || ta || panel);
        const sPanel = getComputedStyle(panel);

        const bg = sInput.backgroundColor || sPanel.backgroundColor;
        const surface = sBtn.backgroundColor || sInput.backgroundColor || sPanel.backgroundColor;
        const text = sInput.color || sPanel.color;
        const border = sInput.borderColor || sBtn.borderColor || sPanel.borderColor;

        if (bg) wrapper.style.setProperty("--lqp-bg", bg);
        if (surface) wrapper.style.setProperty("--lqp-surface", surface);
        if (text) wrapper.style.setProperty("--lqp-text", text);
        if (border && border !== "initial" && border !== "rgba(0, 0, 0, 0)" && border !== "transparent") wrapper.style.setProperty("--lqp-border", border);
      } catch(_){}
    }
    function scheduleThemeSync(){
      if (themeSyncRAF) return;
      themeSyncRAF = requestAnimationFrame(() => { themeSyncRAF = 0; syncThemeVars(); });
    }

    function ensureActionsPadding(actions){
      requestAnimationFrame(()=>{
        const w = actions ? actions.getBoundingClientRect().width : 0;
        box.style.setProperty("--lqp-actions-pad", Math.ceil(w + 14) + "px");
      });
    }

    function renderBox() {
      syncThemeVars();
      box.innerHTML = "";
      if (!selected.size) {
        box.append(el("span", { class: "lqp-placeholder" }, "Click to select LoRA..."));
      } else {
        Array.from(selected).forEach(([name, obj]) => {
          const w = (obj && typeof obj.w === "number") ? clamp(obj.w, WEIGHT_MIN, WEIGHT_MAX) : 1.0;
          const on = (obj && typeof obj.on === "boolean") ? obj.on : true;

          const chip = el("div", { class: "lqp-chip" + (on ? "" : " off"), draggable: "true", dataset: { name } });
          const chk = el("input", { type: "checkbox", ...(on ? {checked:"checked"} : {}) , title:"Enable/disable LoRA"});
          const nm = el("span", {}, name);
          const wt = el("span", { class: "lqp-w", title: "Drag horizontally (Alt for fine adjust)" }, w.toFixed(2));
          const rm = el("button", { type: "button", class: "lqp-x", title: "Remove" }, "×");

          let dragging = false, sx = 0, sw = w;
          wt.addEventListener("mousedown", (e) => {
            if (!selected.get(name)?.on) return;
            e.preventDefault(); dragging = true; sx = e.clientX; sw = selected.get(name).w;
          });
          document.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const dragDiv = e.altKey ? 120 : 40;
            const nw = clamp(Math.round((sw + (e.clientX - sx) / dragDiv) / 0.05) * 0.05, WEIGHT_MIN, WEIGHT_MAX);
            const obj = selected.get(name) || {w:1,on:true};
            obj.w = nw; selected.set(name, obj);
            wt.textContent = nw.toFixed(2);
          });
          document.addEventListener("mouseup", () => (dragging = false));

          rm.addEventListener("click", () => { selected.delete(name); renderBox(); });
          chk.addEventListener("change", () => {
            const obj = selected.get(name) || {w:1,on:true};
            obj.on = chk.checked; selected.set(name, obj);
            chip.classList.toggle("off", !chk.checked);
          });

          chip.addEventListener("dragstart", (e) => { dragName = name; e.dataTransfer.effectAllowed = "move"; });
          chip.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
          chip.addEventListener("drop", (e) => {
            e.preventDefault();
            if (!dragName || dragName === name) return;
            const keys = Array.from(selected.keys());
            const from = keys.indexOf(dragName);
            const to = keys.indexOf(name);
            if (from < 0 || to < 0) return;
            const moved = keys.splice(from, 1)[0];
            keys.splice(to, 0, moved);
            const newMap = new Map();
            keys.forEach(k => newMap.set(k, selected.get(k)));
            selected.clear();
            keys.forEach(k => selected.set(k, newMap.get(k)));
            renderBox();
          });

          chip.append(chk, nm, wt, rm);
          box.append(chip);
        });
      }

      const actions = el("div", { class: "lqp-actions" });
      const addBtn = (title, text, onClick) => {
        const b = el("button", { class: "lqp-btn", type: "button", title }, text);
        b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
        actions.append(b);
        return b;
      };

      addBtn("Enable/disable all", "◎", () => {
        const anyOff = Array.from(selected.values()).some(v => !v || v.on === false);
        selected.forEach((v, k) => { const obj = v || {w:1,on:true}; obj.on = anyOff; selected.set(k, obj); });
        renderBox();
      });

      addBtn("Save preset", "💾", () => {
        const name = prompt("Preset name:");
        if (!name) return;
        const items = Array.from(selected).map(([n, o]) => ({ name: n, w: (o && typeof o.w==='number')?o.w:1.0, on: !!(o && o.on) }));
        presets[name] = { items, ts: Date.now() };
        writePresets(presets);
        closePresetMenu();
      });

      addBtn("Load preset", "📂", () => { openPresetMenu(actions); });

      addBtn("Export favorites and presets (JSON)", "⇩", () => {
        const data = { version:"1.0", favorites, presets };
        const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "lora_quickpick_backup.json"; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      });

      addBtn("Import favorites and presets (JSON)", "⇧", () => {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "application/json";
        inp.addEventListener("change", () => {
          const file = inp.files && inp.files[0];
          if (!file) return;
          const fr = new FileReader();
          fr.onload = () => {
            try{
              const data = JSON.parse(fr.result);
              if (data && Array.isArray(data.favorites)) {
                favorites.splice(0, favorites.length, ...data.favorites);
                syncFavorites();
              }
              if (data && data.presets) { presets = (typeof data.presets === "object" && data.presets) ? data.presets : presets; writePresets(presets); }
              closePresetMenu();
              alert("Import completed");
            }catch(err){ alert("Failed to import JSON"); }
          };
          fr.readAsText(file, "utf-8");
        });
        inp.click();
      });

      addBtn("Clear all", "×", () => { selected.clear(); renderBox(); });

      box.append(actions);
      ensureActionsPadding(actions);
    }

    function closeMenu() { const m = wrapper.querySelector(".lqp-menu"); if (m) m.remove(); }
    function closePresetMenu() { const m = wrapper.querySelector(".lqp-preset-menu"); if (m) m.remove(); }

    function openPresetMenu(anchor){
      closePresetMenu();
      const presetMenu = el("div", { class: "lqp-preset-menu" });
      const hdr = el("div", { class: "hdr" }, el("div", {}, "Presets"), el("button", { class: "lqp-btn", type: "button" }, "×"));
      hdr.lastChild.addEventListener("click", closePresetMenu);
      const list = el("div", { class: "list" });
      const names = Object.keys(presets||{}).sort((a,b)=>a.localeCompare(b));
      if (!names.length){
        list.append(el("div", { class:"row", style: { opacity: 0.6 } }, "No saved presets"));
      } else {
        names.forEach(name => {
          const row = el("div", { class: "row" });
          const btn = el("button", { class: "lqp-btn", type: "button", title:"Load" }, name);
          const del = el("button", { class: "lqp-btn", type: "button", title:"Delete" }, "×");
          btn.addEventListener("click", () => {
            const p = presets[name];
            if (!p || !Array.isArray(p.items)) return;
            selected.clear();
            p.items.forEach(it => { selected.set(it.name, { w: (typeof it.w==='number' ? clamp(it.w, WEIGHT_MIN, WEIGHT_MAX) : 1.0), on: !!it.on }); });
            renderBox(); closePresetMenu();
          });
          del.addEventListener("click", () => {
            if (!confirm(`Delete preset "${name}"?`)) return;
            delete presets[name]; writePresets(presets);
            openPresetMenu(anchor);
          });
          row.append(btn, del);
          list.append(row);
        });
      }
      presetMenu.append(hdr, list);
      wrapper.append(presetMenu);
      const rect = anchor.getBoundingClientRect();
      const wrect = wrapper.getBoundingClientRect();
      presetMenu.style.right = "0";
      presetMenu.style.top = (rect.bottom - wrect.top + 6) + "px";

      const onDoc = (e) => { if (!wrapper.contains(e.target)) { closePresetMenu(); document.removeEventListener("mousedown", onDoc); } };
      setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    }

    function openMenu() {
      syncThemeVars();
      if (wrapper.querySelector(".lqp-menu")) return;
      const menu = el("div", { class: "lqp-menu" });
      const left = el("div", { class: "lqp-left" });
      const right = el("div", { class: "lqp-right" });
      const top = el("div", { class: "lqp-top" });
      const search = el("input", { class: "lqp-search", placeholder: "Search..." });

      const allKey = LS_KEYS.searchAll;
      const allPref = localStorage.getItem(allKey);
      const allInit = (allPref === null) ? true : (allPref === "1");
      const allToggle = el("label", { class: "lqp-all", title: "Search across all folders (only when the search query is not empty)" },
        el("input", { type:"checkbox", ...(allInit ? {checked:"checked"} : {}) }),
        el("span", {}, "everywhere")
      );

      const refreshBtn = el("button", { class: "lqp-refresh", title: "Refresh list (without UI reload)" }, "⟳");

      top.append(search, allToggle, refreshBtn);
      // --- Grid mode controls ---
      (function(){ if(!document.getElementById('lqp-grid-style')){ const s=document.createElement('style'); s.id='lqp-grid-style'; s.textContent=`
      #lora-quickpick .lqp-modebar{ display:flex; gap:.4rem; align-items:center; }
      #lora-quickpick .lqp-btn{ padding:.35rem .6rem; border:1px solid var(--lqp-border); background: var(--lqp-surface); color: var(--lqp-text); border-radius:.5rem; cursor:pointer; }
      #lora-quickpick .lqp-btn.is-active{ outline:2px solid var(--lqp-active); }
      #lora-quickpick .lqp-grid{ overflow:auto; padding:.35rem; background: var(--lqp-bg); display:grid; gap:.75rem; }
      #lora-quickpick .lqp-grid--s{ grid-template-columns: repeat(5, 1fr); }
      #lora-quickpick .lqp-grid--m{ grid-template-columns: repeat(4, 1fr); }
      #lora-quickpick .lqp-grid--l{ grid-template-columns: repeat(3, 1fr); }
      #lora-quickpick .lqp-tile{ position:relative; aspect-ratio:1/1; border:1px solid var(--lqp-border); border-radius:.6rem; overflow:hidden; display:flex; align-items=end; justify-content:center; background:var(--lqp-surface); }
      #lora-quickpick .lqp-tile__img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      #lora-quickpick .lqp-tile__caption{ position:relative; z-index:1; padding:.35rem .5rem; background:var(--lqp-overlay); width:100%; text-align:center; font-size:.85rem; color:var(--lqp-text); }
      #lora-quickpick .lqp-tile--empty{ background:var(--lqp-bg); }
      
      /* layout robustness */
      #lora-quickpick .lqp-grid{ align-content:start; }
      #lora-quickpick .lqp-tile{ box-sizing:border-box; min-width:0; }
      #lora-quickpick .lqp-tile__caption{
        white-space:normal; word-break:break-word; overflow:hidden;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
        line-height:1.1; max-height:2.4em;
      }

      /* hard constraints to prevent overlap */
      #lora-quickpick .lqp-grid{ 
        align-content:start; justify-items:stretch; box-sizing:border-box; 
        grid-auto-rows: 1fr;
      }
      #lora-quickpick .lqp-grid > .lqp-tile{ min-width:0; width:100%; }
      #lora-quickpick .lqp-tile{ box-sizing:border-box; width:100%; }
      #lora-quickpick .lqp-tile__img{ width:100%; height:100%; }
      #lora-quickpick .lqp-tile__caption{ width:100%; }

      /* Fix vertical overlap: explicit square spacer */
      #lora-quickpick .lqp-grid{ grid-auto-rows: auto; }
      #lora-quickpick .lqp-tile{
        position:relative; display:block; /* break from flex to pure block */
        box-sizing:border-box; width:100%; min-width:0; overflow:hidden;
      }
      #lora-quickpick .lqp-tile::before{
        content:""; display:block; padding-top:100%; /* square height anchor */
      }
      #lora-quickpick .lqp-tile__img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      #lora-quickpick .lqp-tile__caption{
        position:absolute; left:0; right:0; bottom:0; width:100%;
        white-space:normal; word-break:break-word; overflow:hidden;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
        line-height:1.1; max-height:2.4em;
      }

      /* Switch to flex layout to avoid row height calc issues */
      #lora-quickpick .lqp-grid{
        display:flex !important; flex-wrap:wrap !important;
        gap: var(--lqp-gap, 12px) !important;
        width:100% !important; align-content:flex-start !important; justify-content:flex-start !important;
      }
      #lora-quickpick .lqp-grid .lqp-tile{ width:100%; min-width:0; box-sizing:border-box; }
      #lora-quickpick .lqp-grid--s .lqp-tile{ width: calc((100% - 4*var(--lqp-gap, 12px))/5) !important; }
      #lora-quickpick .lqp-grid--m .lqp-tile{ width: calc((100% - 3*var(--lqp-gap, 12px))/4) !important; }
      #lora-quickpick .lqp-grid--l .lqp-tile{ width: calc((100% - 2*var(--lqp-gap, 12px))/3) !important; }
      /* Ensure intrinsic height via square spacer */
      #lora-quickpick .lqp-tile{ position:relative; display:block; overflow:hidden; }
      #lora-quickpick .lqp-tile::before{ content:""; display:block; padding-top:100%; }
      #lora-quickpick .lqp-tile__img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      #lora-quickpick .lqp-tile__caption{
        position:absolute; left:0; right:0; bottom:0; width:100%;
        white-space:normal; word-break:break-word; overflow:hidden;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
        line-height:1.1; max-height:2.4em;
      }

      /* Star (favorite) overlay for tiles */
      #lora-quickpick .lqp-tile .star{
        position:absolute;
        top:4px;
        right:5px;
        z-index:3;
        margin:0;
        padding:0 .25rem;
        background:var(--lqp-overlay-strong);
        border-radius:999px;
        font-size:.9rem;
      }
`; document.head.appendChild(s);} })();
      const modeBar = el('div', { class:'lqp-modebar' });
      const btnList = el('button', { class:'lqp-btn', title:'List', type:'button' }, '≣');
      const btnGrid = el('button', { class:'lqp-btn', title:'Grid',  type:'button' }, '▦');
      const btnS = el('button', { class:'lqp-btn', title:'5 per row', type:'button' }, 'S');
      const btnM = el('button', { class:'lqp-btn', title:'4 per row', type:'button' }, 'M');
      const btnL = el('button', { class:'lqp-btn', title:'3 per row', type:'button' }, 'L');
      modeBar.append(btnList, btnGrid, btnS, btnM, btnL);
      top.append(modeBar);

      const list = el("div", { class: "lqp-list" });
      const grid = el('div', { class:'lqp-grid lqp-grid--m' }); grid.style.display='none';
      right.append(top, list, grid);
      const MODE_KEY='lqp:view', SIZE_KEY='lqp:size';
      let viewMode=localStorage.getItem(MODE_KEY)||'list';
      let viewSize=localStorage.getItem(SIZE_KEY)||'m';
      function applyMode(){ list.style.display=(viewMode==='list')?'':'none'; grid.style.display=(viewMode==='grid')?'':'none'; btnList.classList.toggle('is-active',viewMode==='list'); btnGrid.classList.toggle('is-active',viewMode==='grid'); }
      function applySize(){ grid.classList.remove('lqp-grid--s','lqp-grid--m','lqp-grid--l'); grid.classList.add('lqp-grid--'+viewSize); btnS.classList.toggle('is-active',viewSize==='s'); btnM.classList.toggle('is-active',viewSize==='m'); btnL.classList.toggle('is-active',viewSize==='l'); }

      function rebuildGrid(){
        const prevScroll = grid.scrollTop;          // <--- keep current scroll
        grid.replaceChildren();
        const rows = list.querySelectorAll('.lqp-item');
        rows.forEach((r)=>{
          const name = r.dataset.name || (r.querySelector('span')?.textContent.trim() || (r.textContent||'').trim());
          const key  = r.dataset.folder || '';
          const favKey = `${key}::${name}`;
          const isFav = favorites.includes(favKey);
          const enc = encodeURIComponent; const base = `/lora-quickpick/preview?name=${enc(name)}${key?`&key=${enc(key)}`:''}`;
          const v = (window._lqpImgVer || Date.now());
          const cands = [base+`&ext=png&v=${v}`, base+`&ext=jpg&v=${v}`, base+`&ext=jpeg&v=${v}`, base+`&ext=webp&v=${v}`];
          const tile = el('button', { class:'lqp-tile', type:'button', title:name });
          const img = new Image(); img.className='lqp-tile__img'; let i=0; img.onerror=()=>{ if(i<cands.length) img.src=cands[i++]; else { img.remove(); tile.classList.add('lqp-tile--empty'); } }; img.onload=()=>{}; img.src=cands[i++];
          const cap = el('div', { class:'lqp-tile__caption' }, name);
          const star = el('span', { class:'star', title:'Add to favorites / remove' }, isFav ? '★' : '☆');
          star.addEventListener('click', (e)=>{
            e.stopPropagation();
            const k = favKey;
            const idx = favorites.indexOf(k);
            if (idx >= 0) favorites.splice(idx, 1); else favorites.unshift(k);
            syncFavorites();
            const on = favorites.includes(k);
            star.textContent = on ? '★' : '☆';
            const listStar = r.querySelector('.star');
            if (listStar) listStar.textContent = on ? '★' : '☆';
          });
          tile.addEventListener('click', ()=> r.click());
          tile.append(img, cap, star);
          grid.appendChild(tile);
        });
        grid.scrollTop = prevScroll;                // <--- and restore it
      }

      btnList.onclick=()=>{viewMode='list'; localStorage.setItem(MODE_KEY,'list'); applyMode();};
      btnGrid.onclick=()=>{viewMode='grid'; localStorage.setItem(MODE_KEY,'grid'); applyMode(); rebuildGrid();};
      btnS.onclick=()=>{viewSize='s'; localStorage.setItem(SIZE_KEY,'s'); applySize();};
      btnM.onclick=()=>{viewSize='m'; localStorage.setItem(SIZE_KEY,'m'); applySize();};
      btnL.onclick=()=>{viewSize='l'; localStorage.setItem(SIZE_KEY,'l'); applySize();};
      if(!['list','grid'].includes(viewMode)) viewMode='list'; if(!['s','m','l'].includes(viewSize)) viewSize='m'; applyMode(); applySize();

      // >>> adjusted MutationObserver: react only to add/remove of .lqp-item
      const mo = new MutationObserver((mutations) => {
        if (viewMode !== 'grid') return;

        let needsRebuild = false;

        for (const m of mutations) {
          const check = (node) =>
            node.nodeType === 1 &&
            node.classList &&
            node.classList.contains('lqp-item');

          if ([...m.addedNodes].some(check) || [...m.removedNodes].some(check)) {
            needsRebuild = true;
            break;
          }
        }

        if (needsRebuild) rebuildGrid();
      });
      mo.observe(list, { childList:true, subtree:true });
      // <<< end of change

      menu.append(left, right);
      wrapper.append(menu);

      requestAnimationFrame(()=>{
        const rect = menu.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        if (rect.right > vw - 8){ menu.style.left = "auto"; menu.style.right = "0"; }
      });

      const folders = ["★ Favorites", ...Object.keys(State.folders||{})];
      let current = (lastFolder && folders.includes(lastFolder)) ? lastFolder : (folders.includes("★ Favorites") && favorites.length ? "★ Favorites" : (folders.includes("") ? "" : folders[0] || ""));
      let lastRenderKey = null;

      function renderFolders() {
        left.innerHTML = "";
        folders.forEach((f) => {
          const b = el("button", { class: "lqp-folder" + (f === current ? " active" : ""), type: "button" }, f || "(root)");
          b.addEventListener("click", () => { current = f; lastFolder = f === "★ Favorites" ? lastFolder : f; localStorage.setItem(LS_KEYS.lastFolder, lastFolder); renderFolders(); renderLoras(); });
          left.appendChild(b);
        });
      }

      function listForFolder(folderKey){
        if (folderKey === "★ Favorites"){
          const items = [];
          favorites.forEach(k=>{
            const [fk, name] = k.split("::");
            if(State.folders[fk] && State.folders[fk].includes(name)) items.push({folder: fk, name});
          });
          // show favorites in alphabetical order without changing storage order
          items.sort((a, b) => a.name.localeCompare(b.name));
          return items;
        } else {
          return (State.folders[folderKey]||[]).map(n=>({folder: folderKey, name: n}));
        }
      }

      function renderLoras() {
        const q = (search.value || "").toLowerCase().trim();
        const scopeAll = allToggle.querySelector("input").checked;

        const curKey = `${current}||${q}||${scopeAll ? '1' : '0'}`;
        const sameContext = (lastRenderKey === curKey);
        const prevScroll = sameContext ? list.scrollTop : 0;

        list.innerHTML = "";

        let items = [];
        const useGlobal = scopeAll && q.length > 0;
        if (useGlobal){
          Object.keys(State.folders).forEach(fk=> (State.folders[fk]||[]).forEach(n=> items.push({folder: fk, name: n})));
        } else {
          items = listForFolder(current);
        }

        if (q) items = items.filter(it=> it.name.toLowerCase().includes(q));

        if (!items.length) {
          list.append(el("div", { class: "lqp-item", style: { opacity: 0.6, cursor: "default" } }, "Empty"));
          lastRenderKey = curKey;
          list.scrollTop = sameContext ? prevScroll : 0;
          return;
        }

        items.forEach((it, idx) => {
          const leftName = el("span", {}, it.name);
          const tw = State.triggers[it.name];
          const hint = tw && tw.length ? `  —  ${tw.join(", ")}` : "";
          const favKey = `${it.folder}::${it.name}`;
          const star = el("span", { class: "star", title: "Add to favorites / remove" }, (favorites.includes(favKey) ? "★" : "☆"));
          const row = el("button", { class: "lqp-item", type: "button", dataset: { name: it.name, folder: it.folder }, title: `${it.folder ? it.folder + " / " : ""}${it.name}${hint}` }, leftName, star);
          row.addEventListener("click", (e) => {
            if (e.target === star){ 
              const k = favKey;
              const j = favorites.indexOf(k);
              if (j>=0) favorites.splice(j,1); else favorites.unshift(k);
              syncFavorites();
              star.textContent = (favorites.includes(k) ? "★" : "☆");
              return;
            }
            const prefW = Number(State?.prefs?.[it.name]);
            const defW = Number.isFinite(prefW) ? clamp(prefW, WEIGHT_MIN, WEIGHT_MAX) : 1.0;
            if (!selected.has(it.name)) selected.set(it.name, { w: defW, on: true });
            lastFolder = current !== "★ Favorites" ? current : lastFolder;
            localStorage.setItem(LS_KEYS.lastFolder, lastFolder);
            renderBox();
          });
          list.appendChild(row);
          if (idx===0) row.dataset.first = "1";
        });

        if (sameContext) {
          list.scrollTop = prevScroll;
        } else {
          list.scrollTop = 0;
        }
        lastRenderKey = curKey;
      }

      async function refreshNow(btn){
        btn.disabled = true; const old = btn.textContent; btn.textContent = "…";
        const [f, t, p] = await Promise.all([
          fetchJSON("/lora-quickpick/list"),
          fetchJSON("/lora-quickpick/triggers"),
          fetchJSON("/lora-quickpick/prefweights")
        ]);
        State.folders = f || {}; State.triggers = t || {}; State.prefs = p || {}; window._lqpImgVer = (window._lqpImgVer || 1) + 1;
        btn.textContent = old; btn.disabled = false;
        renderFolders(); renderLoras();
      }

      renderFolders(); renderLoras();
      search.focus();
      search.addEventListener("input", renderLoras);
      const allInput = allToggle.querySelector("input");
      allInput.addEventListener("change", () => { 
        localStorage.setItem(allKey, allInput.checked ? "1" : "0");
        renderLoras(); 
      });
      refreshBtn.addEventListener("click", (e)=>{ e.stopPropagation(); refreshNow(refreshBtn); });

      const onDoc = (e) => { if (!wrapper.contains(e.target)) { closeMenu(); document.removeEventListener("mousedown", onDoc); } };
      setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    }

    box.addEventListener("mousedown", (e) => {
      if (e.target === box || e.target.classList.contains("lqp-placeholder")) openMenu();
    });

    // Keep colors synced with theme/preset changes even before user opens the menu.
    scheduleThemeSync();
    setTimeout(scheduleThemeSync, 0);
    setTimeout(scheduleThemeSync, 200);
    setTimeout(scheduleThemeSync, 700);
    try{
      const themeObserver = new MutationObserver(() => scheduleThemeSync());
      const headOrRoot = document.head || document.documentElement;
      themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["class","style","data-theme","data-mode"] });
      if (document.body) themeObserver.observe(document.body, { attributes:true, attributeFilter:["class","style","data-theme","data-mode"] });
      if (headOrRoot) themeObserver.observe(headOrRoot, { childList:true, subtree:true });
      wrapper._lqpThemeObserver = themeObserver;
    }catch(_){}
    try{
      window.addEventListener("focus", scheduleThemeSync);
      document.addEventListener("visibilitychange", scheduleThemeSync);
    }catch(_){}

    renderBox();

    return { wrapper, getSelected: () => Array.from(selected).filter(([_, obj]) => (obj && obj.on)).map(([name, obj]) => ({ name, weight: (obj && typeof obj.w==='number') ? clamp(obj.w, WEIGHT_MIN, WEIGHT_MAX) : 1.0 })) };
  }

  function findPromptContainerFrom(el){
    for (let n = el; n; n = n.parentElement){
      if (n.id && n.id.includes("_prompt_container")) return n;
    }
    return null;
  }
  function place(wrapper, tab){
    let pref = (tab==="img2img") ? "img2img" : "txt2img";
    let negRow = qs(`#${pref}_neg_prompt_row`);
    let negTextarea = qs(`#${pref}_neg_prompt textarea`);
    if (negRow){ const container = findPromptContainerFrom(negRow); if (container){ negRow.insertAdjacentElement("afterend", wrapper); wrapper.style.gridColumn = "1 / -1"; return true; } }
    if (negTextarea){ const container = findPromptContainerFrom(negTextarea); if (container){ let block = negTextarea.closest(".gradio-row, .block, .form") || container; block.insertAdjacentElement("afterend", wrapper); wrapper.style.gridColumn = "1 / -1"; return true; } }
    const pos = qs(`#${pref}_prompt`); const neg = qs(`#${pref}_neg_prompt`); const ca = findPromptContainerFrom(neg) || findPromptContainerFrom(pos) || app(); ca.insertAdjacentElement("beforeend", wrapper); wrapper.style.gridColumn = "1 / -1"; return true;
  }

  function buildAugmentedPrompt(original, selected){
    let res = original;
    const triggers = [];
    selected.forEach(({name}) => {
      const arr = (window._lqpState && window._lqpState.triggers && window._lqpState.triggers[name]) || [];
      arr.forEach(w => { if (w && !triggers.includes(w)) triggers.push(w); });
    });
    const low = res.toLowerCase();
    const toAdd = triggers.filter(w => w && !low.includes(w.toLowerCase()));
    if (toAdd.length){
      const sep = res.trim().length ? (res.trim().endsWith(",") ? " " : ", ") : "";
      res = res + sep + toAdd.join(", ");
    }
    selected.forEach(({name, weight}) => {
      const tok = `<lora:${name}:${weight.toFixed(2)}>`;
      if (!res.includes(tok)) res = (res.trim() + " " + tok).trim();
    });
    return res;
  }

  function installGenerateHook() {
    qsa("#txt2img_generate, #img2img_generate").forEach((btn) => {
      if (btn.dataset._lqp_hooked) return;
      btn.dataset._lqp_hooked = "1";
      btn.addEventListener("click", () => {
        const tab = btn.id.startsWith("img2img") ? "img2img" : "txt2img";
        const ta = qs(`#${tab}_prompt textarea`);
        if (!ta) return;
        const selFn = (window._lqpGetSelected || {})[tab];
        if (!selFn) return;
        const sel = selFn();
        if (!sel.length) return;
        const original = ta.value;
        const augmented = buildAugmentedPrompt(original, sel);
        if (augmented === original) return;
        ta.value = augmented;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        setTimeout(() => { ta.value = original; ta.dispatchEvent(new Event("input", { bubbles: true })); }, 400);
      }, true);
    });
  }

  async function mount() {
    const tick = async () => {
      const hasTxt = !!qs("#txt2img_prompt_container");
      const hasImg = !!qs("#img2img_prompt_container");
      if (!hasTxt && !hasImg) { setTimeout(tick, 200); return; }
      const needData = !window._lqpDataLoaded;
      if (needData){
        const [f, t0, p] = await Promise.all([
          fetchJSON("/lora-quickpick/list"),
          fetchJSON("/lora-quickpick/triggers"),
          fetchJSON("/lora-quickpick/prefweights")
        ]);
        State.folders = f || {}; State.triggers = t0 || {}; State.prefs = p || {};
        window._lqpDataLoaded = true;
      }
      if (hasTxt && !document.getElementById(EXT_ID)) {
        const { wrapper, getSelected } = createUI(EXT_ID);
        place(wrapper, "txt2img");
        (window._lqpGetSelected || (window._lqpGetSelected={})).txt2img = getSelected;
      }
      if (hasImg && !document.getElementById(EXT_ID_IMG2IMG)) {
        const { wrapper, getSelected } = createUI(EXT_ID_IMG2IMG);
        place(wrapper, "img2img");
        (window._lqpGetSelected || (window._lqpGetSelected={})).img2img = getSelected;
      }
      const hook = () => installGenerateHook();
      hook();
      if (!window._lqpMO){
        window._lqpMO = new MutationObserver(hook);
        window._lqpMO.observe(app(), { subtree:true, childList:true });
      }
    };
    tick();
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(mount, 300));
  document.addEventListener("click", () => setTimeout(mount, 300));
})();
;(function(){try{if(!document.getElementById('lqp-grid-style3')){var s=document.createElement('style');s.id='lqp-grid-style3';s.textContent='/* Safe CSS toggle: hide the other view purely by CSS */\n#lora-quickpick .lqp-grid{ width:100% }\n#lora-quickpick .lqp-list{ width:100% }\n#lora-quickpick:has(.lqp-btn-list.is-active) .lqp-grid{ display:none !important; }\n#lora-quickpick:has(.lqp-btn-grid.is-active) .lqp-list{ display:none !important; }\n/* Extra safety if both active due to theme: prefer list */\n#lora-quickpick:has(.lqp-btn-list.is-active):has(.lqp-btn-grid.is-active) .lqp-grid{ display:none !important; }';document.head.appendChild(s);}}catch(_){}})();

;(function(){
  try {
    if (!document.getElementById('lqp-grid-style4')) {
      var s = document.createElement('style');
      s.id = 'lqp-grid-style4';
      s.textContent = '/* Honor inline display:none from original JS even if themes use !important */\n#lora-quickpick .lqp-grid[style*=\'display: none\']{ display:none !important; height:0 !important; padding:0 !important; margin:0 !important; overflow:hidden !important; }\n#lora-quickpick .lqp-list[style*=\'display: none\']{ display:none !important; }\n#lora-quickpick .lqp-grid{ width:100% !important; }\n#lora-quickpick .lqp-list{ width:100% !important; }';
      document.head.appendChild(s);
    }
  } catch (e) { /* no-op */ }
})();

;(function(){try{if(!document.getElementById('lqp-ui-tweaks')){var s=document.createElement('style');s.id='lqp-ui-tweaks';s.textContent='/* UI tweaks: taller box + tighter action buttons */\n#lora-quickpick .lqp-box{ min-height:48px; padding-top:.45rem; padding-bottom:.45rem; }\n#lora-quickpick .lqp-actions{ top:4px; }\n#lora-quickpick .lqp-actions .lqp-btn{ padding:.12rem .38rem; font-size:.9rem; line-height:1; border-radius:.5rem; }\n#lora-quickpick .lqp-btn{ /* general buttons a bit tighter too */ padding:.18rem .48rem; }';document.head.appendChild(s);} }catch(_){}})();

;(function(){try{if(!document.getElementById('lqp-layout-tweaks')){var s=document.createElement('style');s.id='lqp-layout-tweaks';s.textContent='/* Layout tweaks: narrower left, wider right, taller menu */\n#lora-quickpick .lqp-left{ width:200px !important; }\n#lora-quickpick .lqp-right{ flex:1 1 auto; }\n#lora-quickpick .lqp-menu{ max-height:640px !important; height:520px !important; }\n#lora-quickpick .lqp-grid, #lora-quickpick .lqp-list{ max-height:calc(100% - 56px) !important; }';document.head.appendChild(s);}}catch(_){}})();

;(function(){try{if(!document.getElementById('lqp-width-tweak')){var s=document.createElement('style');s.id='lqp-width-tweak';s.textContent='/* Widen the dropdown/menu to full container width */\n#lora-quickpick .lqp-menu{ left:0 !important; right:0 !important; width:auto !important; }\n#lora-quickpick .lqp-right{ min-width:0 !important; }';document.head.appendChild(s);}}catch(_){}})();

;(function(){try{if(!document.getElementById('lqp-actions-tweak')){var s=document.createElement('style');s.id='lqp-actions-tweak';s.textContent='/* Actions bar: bigger icons, tighter compact spacing, centered vertically */\n#lora-quickpick .lqp-box{ min-height:48px; }\n#lora-quickpick .lqp-actions{ display:flex !important; align-items:center; gap:.25rem; top:6px !important; }\n#lora-quickpick .lqp-actions .lqp-btn{ margin:0; padding:.16rem .38rem; font-size:1.06rem; line-height:1; }\n#lora-quickpick .lqp-actions .lqp-btn .lqp-ico{ font-size:1.06rem; line-height:1; }';document.head.appendChild(s);}}catch(_){}})();

;(function(){
  try {
    function dup(id){
      var s = document.getElementById(id);
      if(!s || document.getElementById(id+'-img2img')) return;
      var s2 = document.createElement('style');
      s2.id = id+'-img2img';
      s2.textContent = s.textContent.replaceAll('#lora-quickpick', '#lora-quickpick-img2img');
      document.head.appendChild(s2);
    }
    dup('lqp-grid-style');
    dup('lqp-grid-style3');
    dup('lqp-grid-style4');
    dup('lqp-ui-tweaks');
    dup('lqp-layout-tweaks');
    dup('lqp-width-tweak');
    dup('lqp-actions-tweak');
  } catch(_){}
})();
/* LQP img2img CSS mirror (append-only, no style changes) */
(function(){
  var IDS = ['lqp-style','lqp-grid-style','lqp-grid-style3','lqp-grid-style4','lqp-ui-tweaks','lqp-layout-tweaks','lqp-width-tweak','lqp-actions-tweak'];
  function mirror(id){
    try{
      if(document.getElementById(id+'-img2img')) return;
      var s = document.getElementById(id);
      if(!s || !s.textContent) return;
      var s2 = document.createElement('style');
      s2.id = id+'-img2img';
      s2.textContent = s.textContent.replaceAll('#lora-quickpick', '#lora-quickpick-img2img');
      document.head.appendChild(s2);
    }catch(_){}
  }
  var mo = new MutationObserver(function(){ IDS.forEach(mirror); });
  mo.observe(document.head || document.documentElement, { childList:true, subtree:true });
  IDS.forEach(mirror);
})();
