# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A minimal Zotero 8 bootstrap plugin that adds a **"Copy Collection Link"** item to the right-click context menu on collections. Clicking it copies a `zotero://select/library/collections/KEY` link to the clipboard (or `zotero://select/groups/ID/collections/KEY` for group libraries).

## Build

```bash
./build.sh   # produces zotero-collection-links.xpi
```

The `.xpi` is just a zip of `manifest.json` + `bootstrap.js`. It is gitignored.

## Install / reload

Install via Zotero → Tools → Add-ons → gear icon → Install Add-on From File. After editing code, re-run `build.sh` and reinstall the `.xpi`.

## Architecture

Two files constitute the entire plugin:

- **`manifest.json`** — plugin metadata. Requires `update_url` (even an non-functional URL), `strict_min_version`, and `strict_max_version` in `applications.zotero`. Without `update_url` Zotero 8 rejects the XPI with "extension is invalid".
- **`bootstrap.js`** — all logic. Follows Zotero's bootstrap lifecycle:
  - `startup()` — initializes the `CollectionLinks` object and injects menu items into already-open windows via `Zotero.getMainWindows()`. `Zotero` is a global here — no observer needed.
  - `onMainWindowLoad({ window })` / `onMainWindowUnload({ window })` — called automatically by Zotero for each main window open/close.
  - `shutdown()` — removes all injected elements.

The menu item is appended to the existing `#zotero-collectionmenu` popup (confirmed present in Zotero 7/8 source). The selected collection is read via `ZoteroPane.getSelectedCollection()` at command time. Clipboard write uses `Components.classes["@mozilla.org/widget/clipboardhelper;1"]`.

## Zotero 8 specifics

- Based on Firefox 115–140 (Gecko). `.jsm` modules are replaced by `.sys.mjs` — avoid `ChromeUtils.import("*.jsm")`.
- `manifest.json` must have `"strict_max_version": "8.*"` — without it Zotero treats the plugin as incompatible.
- `Zotero`, `Services`, `Components` are globals in `bootstrap.js` scope.
- `onMainWindowLoad` / `onMainWindowUnload` hooks replace the old `Services.wm.addListener` pattern.
