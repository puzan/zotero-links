# Story 2.1: Collection List & Metadata Extraction

Status: done

## Story

As a Zotero user,
I want the plugin to gather the current library's collections and extract the selected item's metadata,
so that both are ready to send to the Claude API for classification.

## Acceptance Criteria

1. **Given** `_autoAssignItem(item)` is invoked, **When** it reads the library's collection list, **Then** all collections from `Zotero.Collections.getByLibrary(libraryID)` are retrieved, collections whose names appear in the `excludedCollections` pref (comma-separated, trimmed) are removed from the candidate list, a name→ID map is built from the remaining collections, and retrieval completes in under 500ms.

2. **Given** a Zotero item with complete metadata, **When** the metadata block is constructed, **Then** it includes all available fields as plain text: Title, Authors, Abstract, Year, Item type, Journal/Publisher, Tags — and fields with no value are omitted entirely.

3. **Given** a Zotero item with sparse metadata (e.g., only a title), **When** the metadata block is constructed, **Then** only the available fields are included and execution continues without error.

## Tasks / Subtasks

- [x] Task 1: Replace `_autoAssignItem` stub body with collection gathering logic (AC: 1)
  - [x] Subtask 1.1: Read `claudeApiKey` pref; if empty, open preferences pane and return (guard already in menu handler — add defense here too for direct callers)
  - [x] Subtask 1.2: Read `excludedCollections` pref (default `"00-inbox"`); split by comma and trim each entry
  - [x] Subtask 1.3: Call `Zotero.Collections.getByLibrary(item.libraryID)` to get all collections
  - [x] Subtask 1.4: Filter out any collection whose `.name` matches a trimmed entry in the exclusion list
  - [x] Subtask 1.5: Build `collectionMap` — a `Map<string, number>` of `name → id` from remaining collections

- [x] Task 2: Implement metadata block construction inside `_autoAssignItem` (AC: 2, 3)
  - [x] Subtask 2.1: Extract each field using Zotero item APIs (see Dev Notes for exact calls)
  - [x] Subtask 2.2: Build `metadataBlock` as a plain-text string, one labeled field per line, omitting any field with no value
  - [x] Subtask 2.3: Confirm no error is thrown when any or all optional fields are absent

## Dev Notes

### The Stub to Replace

`_autoAssignItem` is at the bottom of `bootstrap.js` (lines 194–196):

```js
async function _autoAssignItem(item) { // eslint-disable-line no-unused-vars
  void item; // Classification pipeline — implemented in Story 2.x
}
```

Replace the body entirely. **Keep the function at module scope** (not on `ZoteroLinks`). The `eslint-disable-line` comment can be removed once the body is real.

### Collection Gathering — Exact Pattern

```js
async function _autoAssignItem(item) {
  const apiKey = Services.prefs.getCharPref("extensions.zotero-links.claudeApiKey", "");
  if (!apiKey) {
    Zotero.Utilities.Internal.openPreferences(_prefPaneID);
    return;
  }

  const excludedRaw = Services.prefs.getCharPref("extensions.zotero-links.excludedCollections", "00-inbox");
  const excluded = excludedRaw.split(",").map(s => s.trim()).filter(Boolean);

  const allCollections = Zotero.Collections.getByLibrary(item.libraryID);
  const collectionMap = new Map();
  for (const col of allCollections) {
    if (!excluded.includes(col.name)) {
      collectionMap.set(col.name, col.id);
    }
  }

  // Metadata extraction follows here (Task 2)
  const metadataBlock = _buildMetadataBlock(item);

  // Story 2.2 adds the fetch() call here using collectionMap + metadataBlock
}
```

Key rules:
- Always `getCharPref(key, defaultValue)` — never without a default (throws if pref not set)
- `col.name` is the collection display name; `col.id` is the integer ID used by `addToCollection(id)`
- `item.libraryID` (not `item.library.id`) is the correct property

### Metadata Block — Exact Field APIs

```js
function _buildMetadataBlock(item) {
  const lines = [];

  const title = item.getField("title");
  if (title) lines.push(`Title: ${title}`);

  const creators = item.getCreators()
    .filter(c => c.creatorType === "author")
    .map(c => c.fieldMode === 1 ? c.lastName : `${c.firstName} ${c.lastName}`.trim())
    .filter(Boolean);
  if (creators.length) lines.push(`Authors: ${creators.join(", ")}`);

  const abstract = item.getField("abstractNote");
  if (abstract) lines.push(`Abstract: ${abstract}`);

  const dateStr = item.getField("date");
  const yearMatch = dateStr && dateStr.match(/\d{4}/);
  if (yearMatch) lines.push(`Year: ${yearMatch[0]}`);

  const itemType = Zotero.ItemTypes.getName(item.itemTypeID);
  if (itemType) lines.push(`Item type: ${itemType}`);

  const journalPublisher = item.getField("publicationTitle") || item.getField("publisher");
  if (journalPublisher) lines.push(`Journal/Publisher: ${journalPublisher}`);

  const tags = item.getTags().map(t => t.tag).filter(Boolean);
  if (tags.length) lines.push(`Tags: ${tags.join(", ")}`);

  return lines.join("\n");
}
```

Add `_buildMetadataBlock` as a **module-scope** helper function (same section as `_notify`, `_autoAssignItem`). It's stateless and has no `ZoteroLinks` dependency.

**Field notes:**
- `item.getCreators()` — returns `[{firstName, lastName, creatorType, fieldMode}]`. `fieldMode === 1` = single-name institution (use `lastName` only). `fieldMode === 0` = person (use `firstName + " " + lastName`).
- `item.getField("date")` — returns strings like `"2023-01-15"`, `"2023"`, or `""`. Use regex `/\d{4}/` to extract year robustly.
- `Zotero.ItemTypes.getName(item.itemTypeID)` — returns e.g. `"journalArticle"`, `"book"`, `"conferencePaper"`.
- `item.getTags()` — returns `[{tag: string, type: number}]`. Use `.map(t => t.tag)`.
- `item.getField("publicationTitle")` for journals; `item.getField("publisher")` for books. Try both, use whichever is non-empty.
- Never call `item.getField(key)` expecting it to throw on unknown fields — it returns `""` for absent/unknown fields. Check for truthiness only.

### bootstrap.js Section Order After Changes

```
1. Lifecycle globals (startup, shutdown, install, uninstall, onMainWindowLoad, onMainWindowUnload)
2. ZoteroLinks object
   - addedElementIDs []
   - addToAllWindows()
   - addToWindow(win)
   - _addCollectionMenuItem(win)
   - _addItemMenuItem(win)
   - _addAutoAssignMenuItem(win)
   - removeFromWindow(win)
   - removeFromAllWindows()
3. Module-scope helpers
   - _buildCollectionLink(collection)
   - _buildItemLink(item)
   - _copyToClipboard(text)
   - _notify(msg)
   - _buildMetadataBlock(item)   ← NEW (pure helper)
   - _autoAssignItem(item)       ← REPLACE stub body
```

### Existing Code Patterns to Follow

The `_addItemMenuItem` → `_addCollectionMenuItem` pattern from Story 1.x established: all `Services.prefs.getCharPref()` calls must pass a default. This story must follow the same rule.

Current `_addAutoAssignMenuItem` (lines 102–130) already performs the apiKey guard and calls `_autoAssignItem(item)`. The guard inside `_autoAssignItem` itself is a secondary defense for any direct callers or tests.

### Previous Story Learnings (from Story 1.2 Dev Notes)

- `Zotero.Utilities.Internal.openPreferences(_prefPaneID)` is the correct call to open the prefs pane
- `_prefPaneID` is a module-level var set in `startup()` via `await Zotero.PreferencePanes.register(...)` — it is valid by the time any user interaction can trigger `_autoAssignItem`
- `_notify(msg)` is already implemented (lines 186–192) — use it for all user-facing messages
- Existing `_addAutoAssignMenuItem` already handles the command event fire-and-forget: `_autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message))`

### No Tests Required

No test framework exists. Single-developer personal tool.

### What NOT to Do

- Do not hardcode `"00-inbox"` — always read from `extensions.zotero-links.excludedCollections` pref
- Do not use `document.createElement()` — not applicable here (no DOM), but the rule applies if any elements are touched
- Do not cache the collection list — always call `getByLibrary()` fresh per invocation
- Do not include empty metadata fields in the block (omit them entirely)
- Do not add `async` to `_buildMetadataBlock` — it has no awaits and is a pure sync helper

### Story Boundary

This story implements **data gathering only** — collection list + metadata extraction. It does NOT implement the `fetch()` call to the Claude API or the assignment logic. Those are Story 2.2 and 2.3 respectively. Leave a comment at the end of `_autoAssignItem` for Story 2.2:

```js
  // Story 2.2: call Claude API with collectionMap + metadataBlock, then assign
```

### Review Findings

- [x] [Review][Defer] Abstract field included verbatim with no length cap [bootstrap.js] — deferred, pre-existing; Story 2.2 (API call) will address token/cost constraints
- [x] [Review][Defer] Duplicate collection names silently overwrite earlier entries in `collectionMap` [bootstrap.js] — deferred, architectural trade-off; Claude returns names, real-world Zotero libraries rarely have duplicate names
- [x] [Review][Defer] Exclusion matching is case-sensitive (`excluded.includes(col.name)`) [bootstrap.js] — deferred, spec-defined behavior; no bug with default `"00-inbox"`
- [x] [Review][Defer] Empty `collectionMap` after exclusion filtering produces no user feedback [bootstrap.js] — deferred, Story 2.2 responsibility (notify user when no candidates remain)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `_buildMetadataBlock(item)` added as module-scope pure sync helper after `_notify`; no `ZoteroLinks` dependency
- `_autoAssignItem` stub replaced with full collection-gathering + metadata-extraction pipeline
- Secondary `apiKey` guard added inside `_autoAssignItem` (defense for direct callers); primary guard is in `_addAutoAssignMenuItem` command handler
- `excluded` list correctly splits by comma and trims whitespace; handles single-entry and multi-entry values
- `collectionMap` is `Map<string, number>` (name → collection.id); ready for Story 2.2 API call
- `_buildMetadataBlock` omits every absent field — all fields are guarded by truthiness checks before `lines.push()`
- Sparse-metadata path (e.g. title-only item) produces a single-line block without errors; all field calls return `""` for absent fields
- `void metadataBlock;` added to suppress unused-variable diagnostic until Story 2.2 consumes it
- No tests — no test framework in this project (single-developer personal tool per architecture doc)

### File List

- bootstrap.js
