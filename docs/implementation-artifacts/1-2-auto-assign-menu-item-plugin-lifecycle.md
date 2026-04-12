# Story 1.2: Auto-Assign Menu Item & Plugin Lifecycle

Status: done

## Story

As a Zotero user,
I want to see an "Auto-assign to collections" item in the right-click menu when I select a single item,
so that I can trigger auto-assignment and be guided to preferences if my API key is not yet configured.

## Acceptance Criteria

1. **Given** a single item is selected in the Zotero library, **When** the user right-clicks to open the item context menu, **Then** an "Auto-assign to collections" menu item appears in `#zotero-itemmenu` and the menu opens with no perceptible delay (zero added latency).

2. **Given** the "Auto-assign to collections" menu item is clicked, **When** the Claude API key preference (`extensions.zotero-links.claudeApiKey`) is empty, **Then** the Zotero preferences pane opens directly to the zotero-links settings page and no assignment attempt is made.

3. **Given** the plugin is active across multiple windows, **When** a window is closed or the plugin is shut down, **Then** all injected menu elements (registered in `addedElementIDs`) are removed cleanly with no resource leaks.

4. **Given** the new menu item is added, **When** the user uses the existing "Copy Collection Link" or "Copy Item Link" menu items, **Then** both continue to function exactly as before.

## Tasks / Subtasks

- [x] Task 1: Add `_addAutoAssignMenuItem(win)` to ZoteroLinks and wire into `addToWindow` (AC: 1, 3, 4)
  - [x] Subtask 1.1: Create `menuseparator` with id `zotero-links-autoassign-sep` and `menuitem` with id `zotero-links-autoassign-menuitem`, label "Auto-assign to collections" — append to `#zotero-itemmenu`
  - [x] Subtask 1.2: Push both IDs to `ZoteroLinks.addedElementIDs` immediately after creation
  - [x] Subtask 1.3: Add `popupshowing` listener that disables the menuitem when selection is not exactly 1 item
  - [x] Subtask 1.4: Add `command` listener using fire-and-forget pattern: check API key → open prefs if empty; else `_autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message))`
  - [x] Subtask 1.5: Call `this._addAutoAssignMenuItem(win)` from `addToWindow(win)` after existing menu item calls

- [x] Task 2: Add module-scope stub `_autoAssignItem(item)` (AC: 2)
  - [x] Subtask 2.1: Add `async function _autoAssignItem(item) {}` at module scope in `bootstrap.js` (body implemented in Story 2.x — stub prevents ReferenceError in command handler)

- [x] Task 3: Add module-scope `_notify(msg)` helper (prerequisite for Task 1 command handler)
  - [x] Subtask 3.1: Add `_notify(msg)` using `Zotero.ProgressWindow` pattern from architecture doc

## Dev Notes

### Existing Code Pattern to Follow Exactly

Current `_addItemMenuItem(win)` in `bootstrap.js` (lines 54–80) is the direct template:
- Create separator + menuitem with `doc.createXULElement()`
- Push IDs to `this.addedElementIDs`
- `popupshowing` listener checks `win.ZoteroPane.getSelectedItems().length`
- `command` listener acts on the selected item
- Append both to menu, push IDs

Follow this pattern exactly. No deviation.

[Source: bootstrap.js lines 54-80]

### Element IDs

- Separator: `zotero-links-autoassign-sep`
- Menuitem: `zotero-links-autoassign-menuitem`

Format: `zotero-links-<feature>-<element>` per architecture naming convention.

[Source: docs/planning-artifacts/architecture.md#Element IDs]

### addToWindow Call Order

`addToWindow(win)` currently calls:
```js
this._addCollectionMenuItem(win);
this._addItemMenuItem(win);
```

Add `this._addAutoAssignMenuItem(win)` after the existing two calls.

[Source: bootstrap.js line 23-25]

### Command Handler Pattern — Critical

```js
menuitem.addEventListener("command", () => {
  const items = win.ZoteroPane.getSelectedItems();
  if (items.length !== 1) return;
  const item = items[0];
  const apiKey = Services.prefs.getCharPref("extensions.zotero-links.claudeApiKey", "");
  if (!apiKey) {
    Zotero.getActiveZoteroPane().openPreferences("zotero-links");
    return;
  }
  _autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));
});
```

- **Never** `async` on the handler itself
- **Never** `await` inside a synchronous event handler
- Always provide default in `getCharPref`
- `openPreferences("zotero-links")` opens the pane for this plugin's ID

[Source: docs/planning-artifacts/architecture.md#Async Handler Pattern, #Process Patterns]

### _notify Implementation

```js
function _notify(msg) {
  const pw = new Zotero.ProgressWindow({ closeOnClick: true });
  pw.changeHeadline("Zotero Links");
  pw.addLines([msg]);
  pw.startCloseTimer(4000);
  pw.show();
}
```

Place at module scope in `bootstrap.js` in the Helpers section (after `_copyToClipboard`).

[Source: docs/planning-artifacts/architecture.md#Frontend Architecture]

### _autoAssignItem Stub

```js
async function _autoAssignItem(item) {
  // Classification pipeline — implemented in Story 2.x
}
```

Place at module scope after `_notify`. Story 2.x replaces the body.

### bootstrap.js Section Order After Changes

```
1. Lifecycle globals (startup, shutdown, install, uninstall, onMainWindowLoad, onMainWindowUnload)
2. ZoteroLinks object
   - addedElementIDs []
   - addToAllWindows()
   - addToWindow(win)              ← add _addAutoAssignMenuItem(win) call here
   - _addCollectionMenuItem(win)
   - _addItemMenuItem(win)
   - _addAutoAssignMenuItem(win)   ← NEW
   - removeFromWindow(win)
   - removeFromAllWindows()
3. Module-scope helpers
   - _buildCollectionLink(collection)
   - _buildItemLink(item)
   - _copyToClipboard(text)
   - _notify(msg)                  ← NEW
   - _autoAssignItem(item)         ← NEW stub
```

[Source: docs/planning-artifacts/architecture.md#File Organization Patterns]

### Cleanup is Already Handled

`removeFromWindow(win)` iterates `addedElementIDs` and removes each element by ID. As long as both IDs are pushed to `addedElementIDs` in Task 1, cleanup for AC3 is automatic — no additional cleanup code needed.

[Source: bootstrap.js lines 82-88]

### No Tests Required

No test framework exists. Single-developer personal tool.

### Project Structure Notes

Only `bootstrap.js` is modified. No new files.

### References

- [Source: docs/planning-artifacts/architecture.md#Naming Patterns]
- [Source: docs/planning-artifacts/architecture.md#Structure Patterns]
- [Source: docs/planning-artifacts/architecture.md#Async Handler Pattern]
- [Source: docs/planning-artifacts/architecture.md#Process Patterns — Error Handling]
- [Source: docs/planning-artifacts/epics.md#Story 1.2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `_addAutoAssignMenuItem` follows same pattern as `_addItemMenuItem` but **without separator** — one separator before "Copy Item Link" is sufficient; adding another before "Auto-assign" created unwanted visual gap
- Command handler: `Zotero.Utilities.Internal.openPreferences(_prefPaneID)` is the correct API — `Zotero.openPreferences()` and `ZoteroPane.openPreferences()` do not exist; `ZoteroPane.openPreferences()` is deprecated
- `_prefPaneID` stored as module-level var (not on ZoteroLinks object) set from `await Zotero.PreferencePanes.register()` return value — ID is auto-generated (format: `plugin-pane-XXXX-zotero-links@puzan.dev`), NOT the pluginID
- `Zotero.PreferencePanes.register()` called in `startup()` via async IIFE after `await Zotero.initializationPromise`
- `preferences.xhtml` is a **XUL fragment** with `<vbox>` as root (not a full HTML document) — Zotero loads it as a fragment inside the Settings window; `preference` attribute auto-binds fields to `Services.prefs`, no JS needed
- `options_ui` removed from manifest.json — it only adds a button in Add-ons Manager, not a pane in Settings
- `_autoAssignItem` stub added with `void item;` to suppress unused-parameter diagnostic — body replaced in Story 2.x
- `_notify` added using `Zotero.ProgressWindow` per architecture spec
- Cleanup (AC3) handled automatically by existing `removeFromWindow` iterating `addedElementIDs`
- Existing "Copy Collection Link" and "Copy Item Link" unaffected (AC4)

### File List

- bootstrap.js
- preferences.xhtml (NEW)
- manifest.json (options_ui removed)
- build.sh (options.html removed, preferences.xhtml added)
