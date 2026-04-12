# Project Context: zotero-links

> LLM-optimized context. Updated: 2026-04-12.

## What It Is

A minimal **Zotero 7/8 bootstrap plugin** (2 files). Adds context menu items for copying `zotero://` links to collections and library items into the clipboard.

## Key Facts

- **Platform**: Zotero 7.0–8.* (Gecko/Firefox 115-140)
- **Files**: `manifest.json` + `bootstrap.js` → packaged as `zotero-links.xpi`
- **Current version**: v0.2.0
- **Plugin ID**: `zotero-links@puzan.dev`

## Current Features (v0.2.0)

1. Right-click on a **collection** → "Copy Collection Link"
   - Personal library: `zotero://select/library/collections/{KEY}`
   - Group library: `zotero://select/groups/{groupID}/collections/{KEY}`
2. Right-click on an **item** → "Copy Item Link" (enabled only when exactly 1 item is selected)
   - `zotero://select/items/{libraryID}_{KEY}`

## Architectural Constraints

- Do not use `.jsm` modules (replaced by `.sys.mjs` in Gecko 115+)
- `Zotero`, `Services`, `Components` are globals — do not import them
- Use `onMainWindowLoad/Unload` for new windows, not `Services.wm.addListener`
- Use `doc.createXULElement(...)` for XUL elements, not `document.createElement(...)`
- Clipboard: only via XPCOM `nsIClipboardHelper`

## Extension Points

- **New menu items**: add `_addXxxMenuItem(win)`, call from `addToWindow(win)`, register IDs in `addedElementIDs`
- **New link formats**: add `_buildXxxLink(item)` helper function
- **Settings/preferences**: would require `Services.prefs` or a separate preferences file
- **New library types**: extend `_buildCollectionLink` for `feeds` or other `libraryType` values

## Build & Deploy

```bash
./build.sh          # dev XPI
./build.sh 1.2.3    # release XPI (does not modify manifest.json)
```

Release via GitHub: push tag `v*` → Actions builds XPI + `updates.json` → GitHub Release.

## `bootstrap.js` Structure

```
startup()
  └─ ZoteroLinks = { addedElementIDs, addToAllWindows, addToWindow,
                     _addCollectionMenuItem, _addItemMenuItem,
                     removeFromWindow, removeFromAllWindows }
  └─ ZoteroLinks.addToAllWindows()

onMainWindowLoad   → ZoteroLinks.addToWindow(window)
onMainWindowUnload → ZoteroLinks.removeFromWindow(window)
shutdown()         → ZoteroLinks.removeFromAllWindows()

Helpers (module-scope):
  _buildCollectionLink(collection) → string | null
  _buildItemLink(item)             → string
  _copyToClipboard(text)           → void
```
