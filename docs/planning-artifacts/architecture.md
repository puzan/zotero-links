---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-12'
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/product-brief-zotero-links.md
  - docs/project-context.md
workflowType: 'architecture'
project_name: 'zotero-links'
user_name: 'Ilya'
date: '2026-04-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (20 total):**

- *Item Classification (FR1–FR6):* Single-item context menu trigger → metadata extraction (all available fields) → Claude API call → response validation → silent multi-collection assignment (up to 3). Graceful handling of sparse/incomplete metadata.
- *Collection Management (FR7–FR9):* Retrieve full library collection list, exclude `00-inbox`, collection names resolved to IDs before assignment.
- *Plugin Configuration (FR10–FR12):* API key stored via `Services.prefs`, editable via plugin preferences pane. Missing key → open preferences pane directly.
- *Error & User Feedback (FR13–FR16):* Notification for: no match, network error, API error. All error paths leave item unchanged.
- *Plugin Lifecycle & Integration (FR17–FR20):* Menu item follows existing `_addXxxMenuItem(win)` pattern, registered in `addedElementIDs`, cleaned up on window unload and plugin shutdown.

**Non-Functional Requirements:**

- *Performance:* 5s end-to-end latency budget (NFR1); zero menu-open latency (NFR2); collection list retrieval <500ms (NFR3)
- *Security:* API key never logged or exposed (NFR4); HTTPS only (NFR5); no metadata caching beyond single call (NFR6)
- *Reliability:* Auto-assign failures must not affect Zotero session stability or existing plugin features (NFR7–NFR9)

**Scale & Complexity:**

- Primary domain: Gecko desktop extension (Zotero 7/8, Firefox 115+)
- Complexity level: low
- Estimated architectural components: 4 (menu injection, metadata extraction, Claude API client, collection assignment + notification)

### Technical Constraints & Dependencies

- **Runtime:** Gecko 115+ globals only — `Zotero`, `Services`, `Components`, `fetch()`. No `.jsm` imports, no Node.js.
- **New file required:** Preferences pane needs an HTML options page — first deviation from the 2-file plugin structure
- **Zotero APIs:** `Zotero.Collections.getByLibrary()`, `item.addToCollection()`, `item.saveTx()`, `Zotero.getActiveZoteroPane().getSelectedItems()`
- **External dependency:** Claude API (`https://api.anthropic.com/v1/messages`), model `claude-haiku-4-5-20251001`
- **Preference key:** `extensions.zotero-links.claudeApiKey` via `Services.prefs`

### Cross-Cutting Concerns Identified

- **Error notification surface:** All failure paths (missing key, network error, API error, no match) use a shared notification mechanism — must be consistent and reusable
- **API key access:** Classification logic reads from `Services.prefs` — must be encapsulated so it's never accidentally logged
- **Lifecycle cleanup:** New menu item elements must be registered in `addedElementIDs` and cleaned up by existing `removeFromWindow` / `removeFromAllWindows` logic
- **Async boundary:** The classification pipeline is async; the context menu handler must be structured so it never blocks the Zotero UI thread

## Starter Template Evaluation

### Primary Technology Domain

Gecko desktop extension (Zotero 7/8 bootstrap plugin). Brownfield project — extending existing 2-file plugin architecture.

### No External Starter Applicable

No npm scaffolding or CLI starter exists for Zotero bootstrap plugins. The existing plugin is the foundation.

### Architectural Foundation: Existing Plugin

**Rationale:** Smart Auto-Assign is an additive feature to an established codebase. All conventions are already set.

**Architectural Decisions Established by Existing Codebase:**

**Language & Runtime:**
Vanilla JavaScript (ES2022+). Gecko 115+ globals (`Zotero`, `Services`, `Components`, `fetch()`). No transpilation, no TypeScript, no package manager.

**Code Organization:**
Single `ZoteroLinks` object in `bootstrap.js`. New capabilities follow the `_addXxxMenuItem(win)` / `_doXxx(item)` naming pattern. All injected DOM elements registered in `addedElementIDs`.

**Build Tooling:**
`./build.sh` — shell script zip to `.xpi`. No bundler. No change required.

**Testing:**
None (single-developer personal tool).

**New File Required:**
`options.html` — plugin preferences pane (HTML options page). First file beyond the original 2-file structure. Declared via `options_ui` in `manifest.json`.

**Note:** No project initialization story needed. Implementation starts directly with feature code.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Claude API request/response contract (shapes the entire classification pipeline)
- Async handling pattern (required before any event handler code is written)
- User notification mechanism (used by all error and feedback paths)

**Important Decisions (Shape Architecture):**
- Response validation strategy (correctness guarantee — no wrong assignments)
- Preferences pane fields and storage keys (required before options.html is written)

**Deferred Decisions (Post-MVP):**
- Attachment text extraction — Phase 2
- Batch processing — Phase 2
- Custom prompt configuration — Phase 3

### API & Communication Patterns

**Claude API Request Design — JSON-constrained output**

Prompt instructs Claude to return a raw JSON array of up to 3 collection names from the provided list, nothing else.

```
System: You are a library classification assistant. Given item metadata and a list of collection names, return a JSON array of up to 3 collection names from the list that best fit the item. Return only the JSON array, nothing else. If no collection fits, return [].
```

- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-haiku-4-5-20251001`
- Auth: `x-api-key` header (read from `Services.prefs`, never logged)
- Transport: `fetch()` (Gecko 115+)
- Payload: `{ model, max_tokens, messages: [{ role: "user", content: "<metadata + collection list>" }] }`
- Response parsing: `JSON.parse(content[0].text)` → string array

**Response Validation — Exact string match**

Every name returned by the API is cross-referenced against the current library's collection name list. Unrecognized names are silently dropped. Assignment proceeds only for validated names. This is the primary hallucination guard — no name that doesn't exist in the library can ever be assigned.

### Authentication & Security

**API Key Storage:**
- Stored via `Services.prefs.setCharPref("extensions.zotero-links.claudeApiKey", key)`
- Read via `Services.prefs.getCharPref("extensions.zotero-links.claudeApiKey", "")`
- Never logged, never included in error messages, never passed outside the `x-api-key` header

### Data Architecture

No persistent data store. All state is transient per classification call:
- Item metadata: extracted in-memory, discarded after API response
- Collection list: fetched from `Zotero.Collections.getByLibrary()` per call, not cached

**Preferences Storage Keys:**

| Key | Type | Default | Purpose |
|---|---|---|---|
| `extensions.zotero-links.claudeApiKey` | string | `""` | Claude API key |
| `extensions.zotero-links.excludedCollections` | string | `"00-inbox"` | Comma-separated list of collection names excluded from classification candidates |

The exclusion list is split by comma and whitespace-trimmed before filtering. Default is `"00-inbox"`. User can add additional collections to exclude via the preferences pane.

### Frontend Architecture

**User Notification — `Zotero.ProgressWindow`**

All user-facing messages (success, no match, errors) use Zotero's built-in `ProgressWindow` API — non-blocking toast-style feedback consistent with other Zotero plugins.

```js
function _notify(msg) {
  const pw = new Zotero.ProgressWindow({ closeOnClick: true });
  pw.changeHeadline("Zotero Links");
  pw.addLines([msg]);
  pw.startCloseTimer(4000);
  pw.show();
}
```

**Preferences Pane — `options.html`**

Two fields:
1. Claude API Key (text input, type="password")
2. Excluded Collections (text input, comma-separated, placeholder "00-inbox")

Declared in `manifest.json` via `options_ui: { page: "options.html" }`.

### Infrastructure & Deployment

No changes. Existing `build.sh` + GitHub Actions CI/CD pipeline handles the new file (`options.html`) automatically — the build script zips all files.

### Async Handling Pattern

**Named async function with explicit `.catch()`**

```js
menuitem.addEventListener("command", () => {
  _autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));
});
```

The async pipeline (`_autoAssignItem`) is fire-and-forget from the event handler's perspective. All expected error paths are handled inside `_autoAssignItem` with `_notify()` calls; the `.catch()` on the outer call is a safety net for unexpected exceptions.

### Decision Impact Analysis

**Implementation Sequence:**
1. Add `options.html` with API key + exclusion list fields
2. Update `manifest.json` with `options_ui`
3. Add `_addAutoAssignMenuItem(win)` following existing pattern
4. Implement `_autoAssignItem(item)`: read prefs → extract metadata → fetch collections → filter exclusions → call Claude API → validate response → assign → notify
5. Implement `_notify(msg)` helper (shared by all paths)

**Cross-Component Dependencies:**
- `_autoAssignItem` depends on `_notify` — implement `_notify` first
- Collection filtering depends on exclusion list pref — prefs must be initialized with defaults on `startup()`
- Response validation depends on collection list being fetched before API call — sequential, not parallel

## Implementation Patterns & Consistency Rules

### Potential Conflict Points Identified

7 areas where AI agents could make incompatible choices in a single-file Gecko extension.

### Naming Patterns

**ZoteroLinks Object Methods:**
- Menu injection: `_addXxxMenuItem(win)` — e.g. `_addAutoAssignMenuItem(win)`
- Action handlers: `_xxxItem(item)` — e.g. `_autoAssignItem(item)`
- Link builders (existing pattern): `_buildXxxLink(item)` — for URL construction only

**Module-Scope Helpers (not on ZoteroLinks object):**
- Stateless utilities: `_notify(msg)`, `_buildCollectionLink()`, `_buildItemLink()` — no `this` dependency → module scope
- Rule: functions that don't access `ZoteroLinks` state go at module scope

**Preference Keys:**
- Always `extensions.zotero-links.<camelCaseName>`
- Examples: `extensions.zotero-links.claudeApiKey`, `extensions.zotero-links.excludedCollections`

**Element IDs:**
- Format: `zotero-links-<feature>-<element>` — e.g. `zotero-links-autoassign-menuitem`

### Structure Patterns

**Code Organization in `bootstrap.js`:**

```
// 1. Lifecycle functions (startup, shutdown, install, uninstall, onMainWindowLoad, onMainWindowUnload)
// 2. ZoteroLinks object (all window-stateful logic)
//    - addToAllWindows / addToWindow / removeFromWindow / removeFromAllWindows
//    - _addXxxMenuItem(win) methods
// 3. Module-scope helper functions (_notify, _buildXxxLink, _copyToClipboard, etc.)
```

New capabilities are added in this order: (a) `_addAutoAssignMenuItem(win)` in ZoteroLinks, (b) called from `addToWindow(win)`, (c) async logic in module-scope `_autoAssignItem(item)`.

**New Files:**
- `options.html` — preferences pane only. No JS logic in the HTML file beyond reading/writing `Services.prefs`. No shared utility imports (none exist).

### Format Patterns

**Claude API Payload:**
```js
{
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [{
    role: "user",
    content: `Collections: ${collectionNames.join(", ")}\n\nItem metadata:\n${metadataBlock}`
  }]
}
```
`max_tokens: 256` is sufficient for a JSON array of 3 short strings. Do not increase without reason.

**Metadata Block Format (plain text, not JSON):**
```
Title: ...
Authors: ...
Abstract: ...
Year: ...
Item type: ...
Journal/Publisher: ...
Tags: ...
```
Omit fields with no value. Do not send empty fields.

**API Response Parsing:**
Always use `response.content[0].text` (Anthropic messages API format).

### Process Patterns

**Error Handling — All Paths Use `_notify()`:**

Every error path calls `_notify(msg)` and returns. No `throw`, no `Zotero.alert()`, no `console.error()` alone.

```js
// Correct
if (!apiKey) {
  Zotero.getActiveZoteroPane().openPreferences("zotero-links");
  return;
}

// Correct
} catch (e) {
  _notify("Could not reach Claude API — check your connection");
  return;
}
```

**Async Handler Pattern:**
```js
// Always this shape on menuitem command:
menuitem.addEventListener("command", () => {
  _autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));
});
```
Never `await` inside a synchronous event handler. Never attach `async` to the handler itself.

**Preferences Read Pattern — Always Provide Default:**
```js
// Correct
Services.prefs.getCharPref("extensions.zotero-links.excludedCollections", "00-inbox")

// Wrong — throws if pref not set
Services.prefs.getCharPref("extensions.zotero-links.excludedCollections")
```

**Pref Initialization in `startup()`:**
```js
if (!Services.prefs.prefHasUserValue("extensions.zotero-links.excludedCollections")) {
  Services.prefs.setCharPref("extensions.zotero-links.excludedCollections", "00-inbox");
}
```

### DOM Patterns

**XUL Element Creation:**
```js
// Always
const el = doc.createXULElement("menuitem");

// Never
const el = document.createElement("menuitem");
```

**Element Cleanup Registration:**
Every injected element ID must be pushed to `ZoteroLinks.addedElementIDs` immediately after creation.

```js
const menuitem = doc.createXULElement("menuitem");
menuitem.id = "zotero-links-autoassign-menuitem";
ZoteroLinks.addedElementIDs.push(menuitem.id);
```

**`item.saveTx()` After Collection Assignment:**
```js
item.addToCollection(collectionID);
await item.saveTx();
```
Never call `addToCollection` without `saveTx()`.

### Enforcement Guidelines

**All AI Agents MUST:**
- Register every injected DOM element ID in `addedElementIDs` before the function returns
- Use `getCharPref(key, defaultValue)` — never without a default
- Call `_notify()` for every user-facing message — never `Zotero.alert()` or bare `console.error()`
- Use `doc.createXULElement()` for all XUL elements — never `createElement()`
- Never log, print, or include the API key in any string
- Call `item.saveTx()` after every `item.addToCollection()`
- Parse Claude API response as `response.content[0].text` (Anthropic messages API format)

**Anti-Patterns:**
- `async function` as direct event handler
- `Services.prefs.getCharPref(key)` without a default value
- Calling Claude API before validating that the API key is non-empty
- Assigning a collection name returned by the API without first verifying it exists in the collection list
- Hardcoding `"00-inbox"` — always read from `extensions.zotero-links.excludedCollections` pref

## Project Structure & Boundaries

### Complete Project Directory Structure

```
zotero-links/
├── manifest.json              # Plugin metadata — add options_ui field
├── bootstrap.js               # All plugin logic — extend ZoteroLinks object
├── options.html               # NEW: Preferences pane (API key + exclusion list)
├── build.sh                   # Unchanged
├── updates.json               # Generated on release — unchanged
├── .github/
│   └── workflows/
│       └── release.yml        # Unchanged — picks up options.html automatically
└── docs/
    └── planning-artifacts/
        └── architecture.md    # This document
```

No new directories. No new JS modules. No bundler. `options.html` is the only new file.

### Architectural Boundaries

**External API Boundary — Claude API:**
- Caller: `_autoAssignItem(item)` (module-scope, `bootstrap.js`)
- Entry point: `fetch("https://api.anthropic.com/v1/messages", ...)`
- Auth: `x-api-key` header sourced from `Services.prefs`
- Contract: sends metadata + collection list, receives JSON array of names
- Error surface: network failure, 4xx/5xx → `_notify()`, item unchanged

**Zotero Internal API Boundaries:**

| Boundary | API | Used By |
|---|---|---|
| Collection read | `Zotero.Collections.getByLibrary(libraryID)` | `_autoAssignItem` |
| Item read | `Zotero.getActiveZoteroPane().getSelectedItems()` | menu `popupshowing` handler |
| Item write | `item.addToCollection(id)` + `item.saveTx()` | `_autoAssignItem` |
| Preferences read/write | `Services.prefs.getCharPref / setCharPref` | `_autoAssignItem`, `options.html`, `startup()` |
| Preferences UI open | `Zotero.getActiveZoteroPane().openPreferences("zotero-links")` | `_autoAssignItem` (missing key path) |
| Notifications | `new Zotero.ProgressWindow(...)` | `_notify()` |

**Preferences Pane Boundary (`options.html`):**
- Reads/writes `Services.prefs` directly via inline script
- No imports, no shared code with `bootstrap.js`
- Two fields only: `claudeApiKey`, `excludedCollections`

### Requirements to Structure Mapping

| FR Group | Location in Codebase |
|---|---|
| FR1 — context menu trigger | `ZoteroLinks._addAutoAssignMenuItem(win)` in `bootstrap.js` |
| FR2 — metadata extraction | `_autoAssignItem(item)` → metadata block construction |
| FR3 — Claude API call | `_autoAssignItem(item)` → `fetch()` call |
| FR4 — response validation | `_autoAssignItem(item)` → name-to-ID cross-reference |
| FR5 — silent assignment | `_autoAssignItem(item)` → `addToCollection` + `saveTx` |
| FR6 — sparse metadata | `_autoAssignItem(item)` → conditional field inclusion |
| FR7–FR9 — collection management | `_autoAssignItem(item)` → `getByLibrary`, exclusion filter, name→ID map |
| FR10–FR12 — preferences pane | `options.html` + `manifest.json` `options_ui` |
| FR13–FR16 — error notifications | `_notify(msg)` helper + error paths in `_autoAssignItem` |
| FR17–FR20 — lifecycle | `ZoteroLinks.addToWindow`, `addedElementIDs`, `removeFromWindow` |

### Integration Points

**Data Flow — Classification Pipeline:**
```
popupshowing event
  └─ getSelectedItems() → item
       └─ command event fires
            └─ _autoAssignItem(item) [async, fire-and-forget]
                 ├─ Services.prefs → apiKey, excludedCollections
                 ├─ Zotero.Collections.getByLibrary() → collectionMap
                 ├─ item.* fields → metadataBlock
                 ├─ fetch(Claude API) → raw JSON
                 ├─ JSON.parse → names[]
                 ├─ validate names against collectionMap → validIDs[]
                 └─ item.addToCollection(id) + item.saveTx() per validID
                      └─ _notify(result message)
```

**Internal Communication:**
- `_notify()` is the single notification surface — called from all error and success paths in `_autoAssignItem`
- `ZoteroLinks.addedElementIDs` is the single cleanup registry — all new element IDs pushed here

**Build Process:**
`build.sh` zips all non-gitignored files in the repo root. Adding `options.html` requires no build script changes — it is included automatically.

### File Organization Patterns

**`bootstrap.js` — section order after changes:**
```
1. Lifecycle globals (startup, shutdown, install, uninstall, onMainWindowLoad, onMainWindowUnload)
2. ZoteroLinks object
   - addedElementIDs []
   - addToAllWindows()
   - addToWindow(win)             ← call _addAutoAssignMenuItem(win) here
   - _addCollectionMenuItem(win)
   - _addItemMenuItem(win)
   - _addAutoAssignMenuItem(win)  ← NEW
   - removeFromWindow(win)
   - removeFromAllWindows()
3. Module-scope helpers
   - _buildCollectionLink(collection)
   - _buildItemLink(item)
   - _copyToClipboard(text)
   - _notify(msg)                 ← NEW
   - _autoAssignItem(item)        ← NEW (async)
```

**`manifest.json` — required addition:**
```json
"options_ui": {
  "page": "options.html",
  "open_in_tab": false
}
```

**`options.html` — structure:**
Standard Zotero plugin options page. Reads/writes `Services.prefs` on load/change. No external scripts.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices are mutually compatible. Vanilla JS, Gecko 115+ globals, `fetch()`, `Services.prefs`, `Zotero.ProgressWindow`, and `doc.createXULElement()` form a consistent, zero-dependency stack with no version conflicts.

**Pattern Consistency:** All patterns derive from the existing codebase conventions. No invented naming or structural patterns — everything aligns with the established `ZoteroLinks` object model.

**Structure Alignment:** The minimal structure (one new file, extensions to two existing files) is coherent with the existing 2-file plugin architecture. No over-engineering, no structural contradictions.

### Requirements Coverage Validation

**Functional Requirements:** All 20 FRs are architecturally covered. Each FR maps to a specific method or code section in `bootstrap.js` or `options.html` (see Requirements to Structure Mapping).

**Non-Functional Requirements:** All 9 NFRs are addressed:
- Performance (NFR1–3): async pipeline, deferred API call, single synchronous collection read
- Security (NFR4–6): key encapsulated in prefs, HTTPS-only transport, no metadata persistence
- Reliability (NFR7–9): all errors isolated to `_notify()`, clean lifecycle cleanup, no resource leaks

### Gap Analysis Results

**Low-risk implementation detail — preferences pane manifest key:**
Zotero 8's exact `manifest.json` key for the preferences pane URL (`options_ui`, `options_url`, or `optionsURL`) must be verified against a working Zotero 8 plugin example before writing the manifest entry. The PRD flagged this as a known risk with a clear mitigation. Does not block architecture — the pattern and file structure are correct.

**No critical gaps identified.**

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (low, 4 components)
- [x] Technical constraints identified (Gecko globals, no .jsm, XUL element creation)
- [x] Cross-cutting concerns mapped (notification, API key, lifecycle cleanup, async boundary)

**Architectural Decisions**
- [x] Claude API request/response contract documented
- [x] Response validation strategy defined (exact match, hallucination guard)
- [x] Async handling pattern specified
- [x] User notification mechanism selected (ProgressWindow)
- [x] Preferences storage keys and defaults defined
- [x] Exclusion list made configurable (not hardcoded)

**Implementation Patterns**
- [x] Naming conventions established (methods, helpers, pref keys, element IDs)
- [x] Code organization order in `bootstrap.js` defined
- [x] Async handler pattern documented with example
- [x] Error handling pattern documented (all paths → `_notify()`)
- [x] DOM creation and cleanup patterns specified
- [x] `saveTx()` requirement documented
- [x] Anti-patterns listed

**Project Structure**
- [x] Complete file list defined (3 files touched, 1 new)
- [x] Classification pipeline data flow mapped
- [x] All Zotero API boundaries documented
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Fully additive — zero risk to existing plugin functionality
- Single async function (`_autoAssignItem`) contains all new complexity
- All error paths are isolated and use a single notification surface
- Configurable exclusion list prevents future hardcoding debt

**Areas for Future Enhancement (Post-MVP):**
- Attachment text extraction (PDF/EPUB) — Phase 2
- Batch inbox processing — Phase 2
- Feedback loop from manual corrections — Phase 3

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect `bootstrap.js` section order (lifecycle → ZoteroLinks object → module-scope helpers)
- Refer to this document for all architectural questions

**First Implementation Steps:**
1. Verify `manifest.json` preferences pane key against a Zotero 8 plugin example
2. Create `options.html` with two fields (API key, excluded collections)
3. Update `manifest.json` with `options_ui` entry and bump version to `0.3.0`
4. Implement `_notify(msg)` helper in `bootstrap.js`
5. Implement `_addAutoAssignMenuItem(win)` and `_autoAssignItem(item)`
6. Initialize pref defaults in `startup()`
