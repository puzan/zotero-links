# Architecture: zotero-links

## Overview

The plugin consists of two files and follows the **Bootstrap Plugin** architecture of Zotero 7/8. All logic lives in the `ZoteroLinks` object, created when `startup()` is called.

## Files

### `manifest.json`

Plugin metadata in Zotero Manifest v2 format.

```json
{
  "manifest_version": 2,
  "name": "Zotero Links",
  "version": "0.1.0",
  "applications": {
    "zotero": {
      "id": "zotero-links@puzan.dev",
      "update_url": "...",
      "strict_min_version": "7.0",
      "strict_max_version": "8.*"
    }
  }
}
```

**Required fields** for Zotero 8:
- `update_url` — without it Zotero 8 rejects the XPI as invalid
- `strict_max_version: "8.*"` — without it the plugin is treated as incompatible

### `bootstrap.js`

The single source file. Declares:
- **Lifecycle functions** (global, called by Zotero)
- **`ZoteroLinks` object** (all state and logic)
- **Helper functions** (`_buildCollectionLink`, `_buildItemLink`, `_copyToClipboard`)

## Plugin Lifecycle

```
install()            ← called on first installation
  │
startup()            ← called on every Zotero launch
  └─ ZoteroLinks.addToAllWindows()   ← injects menus into already-open windows
       │
       ├─ onMainWindowLoad({ window })   ← each new main window
       │    └─ ZoteroLinks.addToWindow(win)
       │
       └─ onMainWindowUnload({ window }) ← on window close
            └─ ZoteroLinks.removeFromWindow(win)

shutdown()           ← on plugin disable/update
  └─ ZoteroLinks.removeFromAllWindows()

uninstall()          ← on plugin removal
```

> `Zotero`, `Services`, `Components` are globals in `bootstrap.js` scope — no imports needed.

## ZoteroLinks Object

### State

| Field | Type | Purpose |
|---|---|---|
| `addedElementIDs` | `string[]` | IDs of all DOM elements injected by the plugin (for clean removal) |

### Methods

| Method | Description |
|---|---|
| `addToAllWindows()` | Iterates `Zotero.getMainWindows()`, calls `addToWindow` for each |
| `addToWindow(win)` | Adds both menu items to the given window |
| `_addCollectionMenuItem(win)` | Injects `menuseparator` + `menuitem` into `#zotero-collectionmenu` |
| `_addItemMenuItem(win)` | Injects `menuseparator` + `menuitem` into `#zotero-itemmenu` |
| `removeFromWindow(win)` | Removes all elements by `addedElementIDs` |
| `removeFromAllWindows()` | Iterates all windows, calls `removeFromWindow` |

## Context Menus

### Copy Collection Link (`#zotero-collectionmenu`)

Injected into the right-click menu on collections in the sidebar.

**Enabled state logic:**
```js
menu.addEventListener("popupshowing", () => {
  menuitem.disabled = !win.ZoteroPane.getSelectedCollection();
});
```
The menu item is disabled when no collection is selected.

**Link format:**
- Personal library: `zotero://select/library/collections/{KEY}`
- Group library: `zotero://select/groups/{groupID}/collections/{KEY}`

### Copy Item Link (`#zotero-itemmenu`)

Injected into the right-click menu on library items.

**Enabled state logic:**
```js
menu.addEventListener("popupshowing", () => {
  menuitem.disabled = items.length !== 1;
});
```
The menu item is enabled only when exactly one item is selected.

**Link format:**
- `zotero://select/items/{libraryID}_{KEY}`
- Example: `zotero://select/items/1_IQ5AWF89`

## Helper Functions

### `_buildCollectionLink(collection)`

```
collection.libraryID
    ↓
Zotero.Libraries.get(libraryID)
    ↓
library.libraryType === "user"  → zotero://select/library/collections/{key}
library.libraryType === "group" → zotero://select/groups/{groupID}/collections/{key}
otherwise                       → null
```

### `_buildItemLink(item)`

```
zotero://select/items/{item.libraryID}_{item.key}
```

### `_copyToClipboard(text)`

Uses XPCOM `nsIClipboardHelper` — the standard clipboard mechanism in Gecko extensions.

```js
Components.classes["@mozilla.org/widget/clipboardhelper;1"]
  .getService(Components.interfaces.nsIClipboardHelper)
  .copyString(text);
```

## CI/CD and Build

### `build.sh`

| Mode | Command | Output |
|---|---|---|
| Dev | `./build.sh` | `zotero-links.xpi` (version from manifest.json) |
| Release | `./build.sh 1.2.3` | `zotero-links-1.2.3.xpi` (version patched via `jq`) |

The versioned build uses `mktemp -d` so the original `manifest.json` is never modified.

### GitHub Actions (`.github/workflows/release.yml`)

| Trigger | Action |
|---|---|
| Any push | Build XPI → upload as Actions Artifact |
| Tag `v*` | Build XPI + generate `updates.json` → GitHub Release |

**`updates.json`** is Zotero's auto-update manifest. The `update_url` in `manifest.json` points to `releases/latest/download/updates.json` — GitHub automatically redirects to the latest release.

## Zotero 8 Compatibility

| Requirement | Solution |
|---|---|
| No `.jsm` modules | `ChromeUtils.import("*.jsm")` not used |
| `strict_max_version` | Set to `"8.*"` in manifest.json |
| New lifecycle hooks | Uses `onMainWindowLoad/Unload` instead of `Services.wm.addListener` |
| Global objects | `Zotero`, `Services`, `Components` used directly |
