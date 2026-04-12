# Story 2.3: Error Handling & User Feedback

Status: done

## Story

As a Zotero user,
I want the plugin to notify me clearly when auto-assignment cannot complete,
so that I always know what happened and my item is never silently left in a wrong state.

## Acceptance Criteria

1. **Given** the Claude API returns a non-empty array but none of the names match any collection in the library, **When** validation completes, **Then** `_notify("No matching collection found")` appears **and** no `addToCollection` call is made and the item remains unchanged.

2. **Given** `fetch()` throws a network error or times out, **When** the API call fails, **Then** `_notify("Could not reach Claude API — check your connection")` is shown **and** the item remains unchanged.

3. **Given** the Claude API returns a 4xx or 5xx HTTP status, **When** the response is checked, **Then** `_notify("Claude API returned an error — check your API key")` is shown **and** the item remains unchanged.

4. **Given** an unexpected exception propagates out of `_autoAssignItem`, **When** the outer `.catch()` on the fire-and-forget handler catches it, **Then** `_notify("Unexpected error: " + err.message)` is shown **and** the Zotero session is unaffected.

## Tasks / Subtasks

- [x] Task 1: Add `_notify` to empty-collection-map early return (AC: 1)
  - [x] Subtask 1.1: At `bootstrap.js` line 246 (`// Story 2.3: _notify("No matching collection found")`), add `_notify("No matching collection found");` immediately before the existing `return;`

- [x] Task 2: Replace network-error rethrow with `_notify` + return (AC: 2)
  - [x] Subtask 2.1: At `bootstrap.js` lines 274–275, replace `// Story 2.3: _notify(...)` comment and `throw e;` with `_notify("Could not reach Claude API — check your connection"); return;`

- [x] Task 3: Replace HTTP-error throw with `_notify` + return (AC: 3)
  - [x] Subtask 3.1: At `bootstrap.js` lines 279–281, replace the `// Story 2.3: _notify(...)` comment and `throw new Error(...)` with `_notify("Claude API returned an error — check your API key"); return;`

- [x] Task 4: Add `_notify` to empty/non-array response early return (AC: 1)
  - [x] Subtask 4.1: At `bootstrap.js` lines 295–298 (`// Story 2.3: _notify("No matching collection found")`), add `_notify("No matching collection found");` immediately before the existing `return;`

- [x] Task 5: Add `_notify` to zero-validated-IDs early return (AC: 1)
  - [x] Subtask 5.1: At `bootstrap.js` lines 305–308 (`// Story 2.3: _notify("No matching collection found")`), add `_notify("No matching collection found");` immediately before the existing `return;`

- [x] Task 6: Verify AC 4 — outer `.catch()` already correct (AC: 4)
  - [x] Subtask 6.1: Confirmed `bootstrap.js` line 125 reads `_autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));` — no code change needed

## Dev Notes

### Exact Changes Required

This story is **purely additive** — 5 `_notify()` calls inserted, 2 `throw` statements replaced. No logic changes, no new functions, no new files.

**`bootstrap.js` — line-by-line changes:**

**Line 245–248** (empty `collectionMap`):
```js
// Before:
  if (collectionMap.size === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

// After:
  if (collectionMap.size === 0) {
    _notify("No matching collection found");
    return;
  }
```

**Lines 273–276** (network error catch):
```js
// Before:
  } catch (e) {
    // Story 2.3: _notify("Could not reach Claude API — check your connection")
    throw e;
  }

// After:
  } catch (e) {
    _notify("Could not reach Claude API — check your connection");
    return;
  }
```

**Lines 278–281** (`!response.ok`):
```js
// Before:
  if (!response.ok) {
    // Story 2.3: _notify("Claude API returned an error — check your API key")
    throw new Error(`Claude API HTTP ${response.status}`);
  }

// After:
  if (!response.ok) {
    _notify("Claude API returned an error — check your API key");
    return;
  }
```

**Lines 295–298** (empty/non-array names):
```js
// Before:
  if (!Array.isArray(names) || names.length === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

// After:
  if (!Array.isArray(names) || names.length === 0) {
    _notify("No matching collection found");
    return;
  }
```

**Lines 305–308** (zero validated IDs):
```js
// Before:
  if (validatedIDs.length === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

// After:
  if (validatedIDs.length === 0) {
    _notify("No matching collection found");
    return;
  }
```

**Line 125** (outer `.catch()` — already correct, no change):
```js
_autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));
```
This satisfies AC 4. Verify and mark done — no edit needed.

### Error Message Contract (Exact Strings — Do NOT Deviate)

| Condition | Exact `_notify()` argument |
|---|---|
| `collectionMap.size === 0` | `"No matching collection found"` |
| `fetch()` throws | `"Could not reach Claude API — check your connection"` |
| `!response.ok` (4xx/5xx) | `"Claude API returned an error — check your API key"` |
| names empty/non-array | `"No matching collection found"` |
| `validatedIDs.length === 0` | `"No matching collection found"` |
| Any uncaught throw | `"Unexpected error: " + err.message` (outer `.catch()`) |

Note: The `—` characters in the network-error and API-error messages are em dashes (U+2014), not hyphens.

### Architecture Compliance

- **All error paths use `_notify()`** — no `throw`, no `Zotero.alert()`, no bare `console.error()` after this story. [Source: docs/planning-artifacts/architecture.md#Process Patterns]
- **`return` after `_notify()`** — every error path exits `_autoAssignItem` without propagating. The outer `.catch()` on the fire-and-forget call handles only truly unexpected exceptions.
- **FR16 compliance** — item is unchanged on all error paths (no `addToCollection` call is made in any error branch).
- **NFR7 compliance** — auto-assign errors are fully isolated; Zotero session stability and existing menu items are unaffected.

### No Tests Required

No test framework exists. Single-developer personal tool. [Source: docs/planning-artifacts/architecture.md#Testing Standards]

### Previous Story Context

Story 2.2 deliberately left `// Story 2.3` comments at every error branch as insertion points. Those comments were reviewed and explicitly deferred. [Source: docs/implementation-artifacts/2-2-claude-api-classification-silent-assignment.md#Review Findings]

After this story, all `// Story 2.3` comments must be removed along with the `throw` statements they accompanied.

### What NOT to Do

- Do not change the exact error message strings — the epics file specifies them verbatim.
- Do not add `throw` or rethrow after `_notify()` — all error paths must `return` cleanly.
- Do not wrap `_notify()` calls in try/catch — `_notify()` uses `Zotero.ProgressWindow` and is reliable.
- Do not modify the outer `.catch()` at line 125 — it is correct and intentional.
- Do not modify any other part of `_autoAssignItem` — this story only replaces stubs.

### Project Structure Notes

Only `bootstrap.js` is modified. No new files.

### References

- Error message strings: [Source: docs/planning-artifacts/epics.md#Story 2.3]
- Error handling pattern (`_notify()` + `return`): [Source: docs/planning-artifacts/architecture.md#Process Patterns]
- FR13–FR16 requirements: [Source: docs/planning-artifacts/epics.md#Requirements Inventory]
- NFR7: [Source: docs/planning-artifacts/epics.md#NonFunctional Requirements]
- Story 2.3 stub comments and deferred review items: [Source: docs/implementation-artifacts/2-2-claude-api-classification-silent-assignment.md]
- `_notify()` implementation: [Source: bootstrap.js lines 186–192]
- Outer `.catch()` location: [Source: bootstrap.js line 125]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Replaced all 5 `// Story 2.3` stub comments in `_autoAssignItem` with live `_notify()` calls
- Network error catch: replaced `throw e` with `_notify("Could not reach Claude API — check your connection"); return;`
- HTTP error guard: replaced `throw new Error(...)` with `_notify("Claude API returned an error — check your API key"); return;`
- Three "no matching collection found" paths (empty collectionMap, empty/non-array names, zero validated IDs): each now calls `_notify("No matching collection found")` before returning
- AC 4 (unexpected exception → "Unexpected error: …"): already satisfied by outer `.catch()` at bootstrap.js line 125 — no change required
- All expected error paths now `return` cleanly; no throws propagate from handled errors
- FR16 compliance verified: item unchanged on all error paths (no `addToCollection` call in any error branch)

**Post-review bug fixes (found during 2.3 review, fixed out-of-story):**

- **Bug fix (Story 2.2):** Claude API was returning text wrapped in markdown code fences (` ```json\n...\n``` `), causing `JSON.parse` to fail with "non-JSON response". Fixed by migrating to Native Structured Outputs (`anthropic-beta: structured-outputs-2025-11-13`) with `tool_choice: {type: "tool", name: "assign_collections"}`. Response is now parsed from `content[].tool_use.input.collections` — no text parsing needed.
- **Bug fix (Story 2.1):** `Zotero.Collections.getByLibrary()` returns only top-level collections. Nested collections were silently excluded from the prompt. Fixed by replacing flat lookup with recursive `_collectRecursive()` using `col.getChildCollections()`. Collection names now include full paths (`Parent / Child`).
- **Out-of-scope addition:** Debug logging feature — `extensions.zotero-links.debugLogging` boolean pref, `_log()` helper writing to `Services.console`, checkbox in `preferences.xhtml`. Logs item context and raw Claude response when enabled.

### File List

- bootstrap.js
- preferences.xhtml

### Change Log

- 2026-04-12: Implemented Story 2.3 — replaced all Story 2.3 stubs with live `_notify()` error messages (network error, HTTP error, no matching collection)
- 2026-04-12: Post-review fixes — migrated to Structured Outputs (fixes non-JSON parse failure), recursive collection gathering (fixes missing nested collections), added debug logging feature
