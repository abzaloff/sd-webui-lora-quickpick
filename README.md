# LoRA QuickPick

LoRA QuickPick is a visual LoRA picker extension for Stable Diffusion WebUI environments.

<img width="899" height="604" alt="8689" src="https://github.com/user-attachments/assets/2fe3138e-54fe-45d2-9750-62b22d4d18f0" />


Primary target:
- Forge Neo

Also tested and stable on:
- Stable Diffusion WebUI (A1111-style)
- Classic Forge

It adds a fast UI for selecting LoRAs in `txt2img` and `img2img`, so you do not need to manually type `<lora:name:weight>` tags every time.

## What It Does

- Scans LoRA model files:
  - `.safetensors`
  - `.pt`
  - `.ckpt`
  - `.bin`
- Shows LoRAs grouped by folders.
- Supports both list and grid views.
- Supports model preview images (`.png`, `.jpg`, `.jpeg`, `.webp`) when available.
- Lets you select multiple LoRAs, reorder them, and set weights quickly.
- Adds selected LoRAs to prompt automatically on **Generate**.
- Supports Hires. fix, including Forge's gallery **✨** upscale button.
- Reads trigger words from sidecar metadata and appends missing triggers.
- Reads `preferred weight` from sidecar metadata when present.
- Provides favorites, presets, and JSON backup/restore.
- Right-click a LoRA to open its context menu:
  - **Edit** opens Forge Neo's built-in LoRA metadata editor.
  - **Move to…** moves the LoRA model, associated preview image(s), and sidecar JSON metadata to another detected LoRA folder.
  - **Delete** removes the LoRA model, its associated preview image(s), and sidecar JSON metadata after confirmation.

## Why Use It

- Faster LoRA workflow.
- Less prompt typo risk.
- Easier navigation for large LoRA collections.
- Reusable style packs via presets.
- Better visual browsing with preview tiles.

## Metadata Sources

LoRA QuickPick looks for metadata files next to each model:

- `model_name.json`
- `model_name_<ext>.json`
- `model_name-<ext>.json`
- `model_name.civitai.info`
- `model_name.txt`

It can extract:
- Trigger words (`activation text`, `triggerWords`, `trainedWords`, etc.)
- `preferred weight`

## Installation

### Install from URL (recommended)

1. Open `Extensions`.
2. Open `Install from URL`.
3. Paste this repository URL.
4. Click `Install`.
5. Restart WebUI.

### Manual install

1. Clone this repo into:
   - `stable-diffusion-webui/extensions/sd-webui-lora-quickpick`
2. Restart WebUI.

## How To Use

1. Open `txt2img` or `img2img`.
2. Find the **LoRA QuickPick** panel under prompt fields.
3. Click the input box to open the LoRA browser.
4. Select one or more LoRAs.
5. Adjust order and weight.
   - Change weight by dragging the weight value left or right with the mouse.
6. Right-click a LoRA in either view to edit its metadata or delete it.
7. Click **Generate**.

On generate, the extension temporarily injects:
- Missing trigger words
- `<lora:name:weight>` tags

Then it restores the original prompt text in the input field.

When using Hires. fix, the selected LoRAs are also injected into the hires prompt pass. In Forge Neo, this includes both the normal **Hires. fix** checkbox flow and the gallery **✨** button that sends the selected image to Hires. fix using the current hires settings.

## Previews

- If a preview image exists near the LoRA, it is shown in grid mode.
- If no preview exists, an empty tile with the model name is shown.

## Compatibility Notes

- Designed first for Forge Neo.
- Works stably on Stable Diffusion WebUI and classic Forge.
- Move and delete actions support LoRAs stored in directory symlinks beneath a configured LoRA root.
- UI injection points: `txt2img`, `img2img`.
- Hires. fix support covers the second-pass prompt and Forge's `txt2img_upscale` gallery action.

## Repository Structure

- `scripts/lora_quickpick.py`
  - Backend API
  - LoRA scanning
  - Trigger/preferred-weight loading
  - Preview endpoint
- `javascript/lora_quickpick.js`
  - UI
  - Selection logic
  - Favorites/presets
  - Generate hook integration

## FAQ

### Why is a tile empty in grid view?

No preview image was found for that LoRA. This is expected behavior.

### Where are favorites and presets stored?

In browser `localStorage` on the client side.

### Are sidecar files required?

No. LoRA selection still works without sidecar files.
Sidecar metadata is only needed for auto trigger words and preferred weight.

## License

See [LICENSE.md](LICENSE.md).
