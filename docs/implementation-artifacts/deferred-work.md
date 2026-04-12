# Deferred Work

## Deferred from: code review of 2-1-collection-list-metadata-extraction (2026-04-12)

- **Abstract field no length cap** (`bootstrap.js` `_buildMetadataBlock`): Full `abstractNote` appended verbatim; could inflate API payload. Address in Story 2.2 when constructing the Claude API request (truncate or cap abstract length).
- **Duplicate collection names in `collectionMap`**: `collectionMap.set(col.name, col.id)` silently overwrites when two collections share a name. Low real-world risk for typical Zotero libraries. If it becomes a problem, switch to `Map<name, id[]>` and handle ambiguity in Story 2.2.
- **Case-sensitive exclusion matching**: `excluded.includes(col.name)` is case-sensitive. If a user types `"00-Inbox"` but the collection is `"00-inbox"`, it won't be excluded. Consider `.toLowerCase()` normalization in a future polish pass.
- **Empty `collectionMap` after filtering**: If all collections are excluded, `collectionMap` is empty and Story 2.2 will proceed to an API call with no candidates. Story 2.2 must guard against this (early-return + `_notify("No candidate collections available")`).

## Deferred from: code review of 2-2-claude-api-classification-silent-assignment (2026-04-12)

- **`saveTx()` per-loop iteration** (`bootstrap.js` lines 307–308): Called after each `addToCollection()` separately; architecture doc prescribes this pattern but it means partial state is saved if a later iteration fails. Intentional design decision — revisit only if transaction semantics become a problem.
- **No retry logic for transient API failures** (`bootstrap.js` line 259): A single `fetch()` attempt with no retry. Transient network blips cause immediate failure. Consider adding 1–2 retries with exponential backoff in a future pass.
- **Collection names and metadata transmitted to external API without user disclosure** (`bootstrap.js` line 251): The full library taxonomy and item metadata leave the user's machine on every call. By design (core feature purpose); a privacy notice or opt-in prompt could be added in a future UX pass.
- **`response.json()` not wrapped in try/catch** (`bootstrap.js` line 283): If the response body is unexpectedly non-JSON despite `response.ok`, the error propagates as an unhandled rejection to the outer `.catch()`. Low risk in practice; could be tightened alongside Story 2.3 error handling cleanup.
