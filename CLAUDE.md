# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A minimal Zotero 8 bootstrap plugin that adds two context menu items:

- **"Copy Collection Link"** — right-click on a collection → `zotero://select/library/collections/KEY` (or `zotero://select/groups/ID/collections/KEY` for group libraries)
- **"Copy Item Link"** — right-click on an item → `zotero://select/items/LIBRARYID_KEY` (e.g. `zotero://select/items/1_IQ5AWF89`)

## Build

```bash
./build.sh              # produces zotero-links.xpi (uses version from manifest.json)
./build.sh 1.2.3        # produces zotero-links-1.2.3.xpi with version patched inside
```

The `.xpi` is a zip of `manifest.json` + `bootstrap.js`. It is gitignored. The versioned build uses a temp dir so the original `manifest.json` is not modified.

## Install / reload

Install via Zotero → Tools → Add-ons → gear icon → Install Add-on From File. After editing code, re-run `build.sh` and reinstall the `.xpi`.

## Architecture

Two files constitute the entire plugin:

- **`manifest.json`** — plugin metadata. Requires `update_url`, `strict_min_version`, and `strict_max_version` in `applications.zotero`. Without `update_url` Zotero 8 rejects the XPI with "extension is invalid".
- **`bootstrap.js`** — all logic in a `ZoteroLinks` object. Follows Zotero's bootstrap lifecycle:
  - `startup()` — initializes `ZoteroLinks` and injects menu items into already-open windows via `Zotero.getMainWindows()`. `Zotero` is a global here — no observer needed.
  - `onMainWindowLoad({ window })` / `onMainWindowUnload({ window })` — called automatically by Zotero for each main window open/close.
  - `shutdown()` — removes all injected elements.

Menu items are appended to `#zotero-collectionmenu` and `#zotero-itemmenu` (both confirmed in Zotero 7/8 source). Item menu item is disabled when selection is not exactly one item. Clipboard write uses `Components.classes["@mozilla.org/widget/clipboardhelper;1"]`.

## CI / releases

`.github/workflows/release.yml` runs on every push:

- **Any commit** — version from `git describe --tags --always`, XPI uploaded as a GitHub Actions artifact.
- **Tag `v*`** — version taken from the tag, release created with two assets: the versioned XPI and `updates.json`.

`updates.json` is the Zotero auto-update manifest. `update_url` in `manifest.json` points to `releases/latest/download/updates.json`, which GitHub redirects to the most recent release — no separate release channel tag needed.

## Zotero 8 specifics

- Based on Firefox 115–140 (Gecko). `.jsm` modules are replaced by `.sys.mjs` — avoid `ChromeUtils.import("*.jsm")`.
- `manifest.json` must have `"strict_max_version": "8.*"` — without it Zotero treats the plugin as incompatible.
- `Zotero`, `Services`, `Components` are globals in `bootstrap.js` scope.
- `onMainWindowLoad` / `onMainWindowUnload` hooks replace the old `Services.wm.addListener` pattern.
