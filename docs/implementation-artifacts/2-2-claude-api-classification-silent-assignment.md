# Story 2.2: Claude API Classification & Silent Assignment

Status: done

## Story

As a Zotero user,
I want the plugin to send the item metadata to Claude and silently assign the item to matching collections,
so that categorization happens without any review dialog or manual action on my part.

## Acceptance Criteria

1. **Given** a valid API key and a non-empty collection candidate list, **When** `_autoAssignItem` calls the Claude API, **Then** a POST is made to `https://api.anthropic.com/v1/messages` over HTTPS with the `x-api-key` header, the payload uses model `claude-haiku-4-5-20251001`, `max_tokens: 256`, the system prompt constraining output to a JSON array, and the metadata + collection names in the user message — and the API key is never included in any log, error message, or string other than the `x-api-key` header.

2. **Given** the Claude API returns a JSON array of collection names, **When** the response is parsed, **Then** each returned name is cross-referenced against the candidate `collectionMap`, names not in the map are silently dropped, and `item.addToCollection(id)` + `item.saveTx()` is called for each validated collection (up to 3), with no confirmation dialog shown.

3. **Given** the item is successfully assigned to at least one collection, **When** assignment completes, **Then** a `_notify()` call confirms the result and item metadata is not retained after the call completes (no caching).

## Tasks / Subtasks

- [x] Task 1: Guard empty `collectionMap` before API call (AC: 1)
  - [x] Subtask 1.1: If `collectionMap.size === 0`, return early (Story 2.3 adds `_notify()` here; leave a `// Story 2.3` comment)

- [x] Task 2: Build and execute `fetch()` call to Claude API (AC: 1)
  - [x] Subtask 2.1: Remove `void metadataBlock` line and `// Story 2.2` comment from current stub
  - [x] Subtask 2.2: Build `userMessage` string: `Collections: ${[...collectionMap.keys()].join(", ")}\n\nItem metadata:\n${metadataBlock}`
  - [x] Subtask 2.3: Call `fetch("https://api.anthropic.com/v1/messages", ...)` with correct headers and body (see Dev Notes for exact shape)
  - [x] Subtask 2.4: Wrap `fetch()` in try/catch; on network error, rethrow (Story 2.3 will replace with `_notify()`; leave `// Story 2.3` comment)

- [x] Task 3: Check HTTP status and parse response (AC: 1, 2)
  - [x] Subtask 3.1: If `!response.ok`, throw `new Error(...)` (Story 2.3 replaces with `_notify()`; leave `// Story 2.3` comment)
  - [x] Subtask 3.2: Parse `(await response.json()).content[0].text` → `JSON.parse(text)` to get names array
  - [x] Subtask 3.3: If result is not an array or is empty, return early (Story 2.3 adds `_notify()`; leave `// Story 2.3` comment)

- [x] Task 4: Validate names and assign collections (AC: 2)
  - [x] Subtask 4.1: Filter names against `collectionMap`, take first 3 validated entries
  - [x] Subtask 4.2: If no valid names, return early (Story 2.3 adds `_notify()`; leave `// Story 2.3` comment)
  - [x] Subtask 4.3: For each validated ID: `item.addToCollection(id)` then `await item.saveTx()` (per-call, not batched)

- [x] Task 5: Success notification (AC: 3)
  - [x] Subtask 5.1: After all assignments complete, call `_notify(...)` with a message indicating how many collections were assigned

## Dev Notes

### Current State of `_autoAssignItem` (bootstrap.js lines 225–247)

Story 2.1 implemented collection gathering and metadata extraction. The function currently ends with:

```js
  const metadataBlock = _buildMetadataBlock(item);
  void metadataBlock; // consumed in Story 2.2

  // Story 2.2: call Claude API with collectionMap + metadataBlock, then assign
}
```

**This story replaces those last two lines** with the full API call + assignment pipeline.

### Complete Implementation Pattern

Replace the `void metadataBlock` line and `// Story 2.2` comment with exactly this block:

```js
  if (collectionMap.size === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

  const collectionNames = [...collectionMap.keys()];
  const userMessage = `Collections: ${collectionNames.join(", ")}\n\nItem metadata:\n${metadataBlock}`;
  const systemPrompt =
    "You are a library classification assistant. Given item metadata and a list of collection names, " +
    "return a JSON array of up to 3 collection names from the list that best fit the item. " +
    "Return only the JSON array, nothing else. If no collection fits, return [].";

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (e) {
    // Story 2.3: _notify("Could not reach Claude API — check your connection")
    throw e;
  }

  if (!response.ok) {
    // Story 2.3: _notify("Claude API returned an error — check your API key")
    throw new Error(`Claude API HTTP ${response.status}`);
  }

  const data = await response.json();
  let names;
  try {
    names = JSON.parse(data.content[0].text);
  } catch (e) {
    throw new Error("Claude API returned non-JSON response");
  }

  if (!Array.isArray(names) || names.length === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

  const validatedIDs = names
    .filter(n => collectionMap.has(n))
    .slice(0, 3)
    .map(n => collectionMap.get(n));

  if (validatedIDs.length === 0) {
    // Story 2.3: _notify("No matching collection found")
    return;
  }

  for (const id of validatedIDs) {
    item.addToCollection(id);
    await item.saveTx();
  }

  _notify(`Auto-assigned to ${validatedIDs.length} collection${validatedIDs.length > 1 ? "s" : ""}`);
```

### Story Boundary — What Belongs Here vs Story 2.3

**Story 2.2 implements:** happy path — API call, parse, validate, assign, success notification.

**Story 2.3 implements:** replace every `throw e` / `throw new Error(...)` / early `return` with specific `_notify()` messages:
- Network error catch → `_notify("Could not reach Claude API — check your connection")`
- `!response.ok` → `_notify("Claude API returned an error — check your API key")`
- No match (empty array, no valid names) → `_notify("No matching collection found")`

The outer `.catch(err => _notify("Unexpected error: " + err.message))` in `_addAutoAssignMenuItem` (line 125) handles any thrown errors for now — so error paths are safe even before Story 2.3.

### API Call Critical Rules

**Required headers** (all three, always):
- `"content-type": "application/json"` — required for POST with JSON body
- `"x-api-key": apiKey` — authentication; `apiKey` variable only (never concatenate into a string for logging)
- `"anthropic-version": "2023-06-01"` — required by the Anthropic Messages API

**System prompt** goes as a top-level `system` field, NOT inside `messages`. This is the Anthropic Messages API format.

**Response parsing** — always `data.content[0].text` (Anthropic messages format), then `JSON.parse()` that string. Not `data.choices[0].message.content` (that's OpenAI).

**API key security** — `apiKey` is only used in the `x-api-key` header value. Never in:
- `_notify()` messages
- `console.log()` or `console.error()`
- Error message strings
- Any variable other than `apiKey`

### `saveTx()` Pattern

The architecture requires `saveTx()` after EVERY `addToCollection()` call:

```js
// Correct — per-call pattern
for (const id of validatedIDs) {
  item.addToCollection(id);
  await item.saveTx();
}

// Wrong — batched (violates architecture rule)
for (const id of validatedIDs) { item.addToCollection(id); }
await item.saveTx();
```

### Metadata Caching — No Action Needed

AC 3 says "item metadata is not retained after the call completes". This is satisfied by the existing design — `metadataBlock` is a local variable in `_autoAssignItem`. No caching logic needs to be added or removed; just don't persist it.

### `collectionMap` Source

`collectionMap` is a `Map<string, number>` (name → `col.id`) built by Story 2.1's code (lines ~236–241). It's already filtered to exclude collections in the `excludedCollections` pref. Use it directly — do not re-fetch collections in this story.

### No Tests Required

No test framework exists. Single-developer personal tool.

### What NOT to Do

- Do not introduce a second `Zotero.Collections.getByLibrary()` call — `collectionMap` is already built
- Do not use `data.choices[0].message.content` — that is OpenAI format; Anthropic uses `data.content[0].text`
- Do not add `async-version` header spelling variant — the header is exactly `"anthropic-version"`
- Do not call `item.saveTx()` once after the loop — call it inside the loop after each `addToCollection()`
- Do not log, print, or include `apiKey` in any string other than the `x-api-key` header value
- Do not add `max_tokens` larger than 256 — a JSON array of 3 short strings fits easily within this limit

### Project Structure Notes

Only `bootstrap.js` is modified. No new files, no other files touched.

Section order in `bootstrap.js` after this story:
```
0. Module-level vars (_prefPaneID)
1. Lifecycle globals (startup, shutdown, install, uninstall, onMainWindowLoad, onMainWindowUnload)
2. ZoteroLinks object
   - addedElementIDs []
   - addToAllWindows / addToWindow
   - _addCollectionMenuItem / _addItemMenuItem / _addAutoAssignMenuItem
   - removeFromWindow / removeFromAllWindows
3. Module-scope helpers
   - _buildCollectionLink / _buildItemLink / _copyToClipboard
   - _notify
   - _buildMetadataBlock
   - _autoAssignItem   ← this story extends the body
```

### References

- API call shape: [Source: docs/planning-artifacts/architecture.md#Format Patterns]
- System prompt text: [Source: docs/planning-artifacts/architecture.md#API & Communication Patterns]
- `saveTx()` requirement: [Source: docs/planning-artifacts/architecture.md#Enforcement Guidelines]
- Async handler pattern + outer `.catch()`: [Source: bootstrap.js line 125]
- `_notify()` implementation: [Source: bootstrap.js lines 186–192]
- `collectionMap` construction: [Source: bootstrap.js lines 235–241]
- `_buildMetadataBlock`: [Source: bootstrap.js lines 194–223]
- Story 2.3 error messages (AC for this context): [Source: docs/planning-artifacts/epics.md#Story 2.3]

### Review Findings

- [x] [Review][Patch] `data.content[0].text` accessed without bounds check — fixed: `data.content?.[0]?.text` with explicit null guard + distinct "unexpected response format" error [bootstrap.js:286]
- [x] [Review][Patch] Whitespace-only API key bypasses `if (!apiKey)` guard — fixed: changed to `if (!apiKey.trim())` [bootstrap.js:226]
- [x] [Review][Defer] `saveTx()` called per-loop iteration [bootstrap.js:307–308] — deferred, intentional per architecture doc ("saveTx after every addToCollection"); pre-existing architectural decision
- [x] [Review][Defer] No retry logic for transient API failures [bootstrap.js:259] — deferred, pre-existing architectural decision; Story 2.3 adds error messaging
- [x] [Review][Defer] Collection names and item metadata transmitted to external API without user disclosure [bootstrap.js:251] — deferred, intentional by design (core feature purpose); privacy notice out of scope
- [x] [Review][Defer] `response.json()` not wrapped in try/catch [bootstrap.js:283] — deferred, low risk; outer `.catch()` on fire-and-forget handles unexpected rejection as "Unexpected error: ..."
- [x] [Review][Defer] `throw e` rethrow on network failure is a Story 2.3 boundary [bootstrap.js:275] — deferred, intentional stub; Story 2.3 replaces with `_notify()`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Replaced `void metadataBlock` stub and `// Story 2.2` comment with full API call + assignment pipeline
- Empty `collectionMap` guard added before fetch (returns early; `_notify` deferred to Story 2.3)
- `fetch()` POST to `https://api.anthropic.com/v1/messages` with three required headers: `content-type`, `x-api-key`, `anthropic-version: 2023-06-01`
- `system` prompt provided as top-level field (Anthropic Messages API format)
- Network error catch rethrows — outer `.catch()` in `_addAutoAssignMenuItem` (line 125) shows "Unexpected error: ..." until Story 2.3 refines it
- `!response.ok` throws — same fallback; `// Story 2.3` comment marks replacement point
- Response parsed via `data.content[0].text` → `JSON.parse()` (Anthropic format, not OpenAI)
- Names validated against `collectionMap`, `.slice(0, 3)`, mapped to IDs
- `item.addToCollection(id)` + `await item.saveTx()` called per collection (per-call, not batched)
- Success notification: `_notify("Auto-assigned to N collection(s)")`
- `apiKey` used only in `x-api-key` header value — never logged or included in error strings

### File List

- bootstrap.js
