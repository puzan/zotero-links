# Deferred Work

## Deferred from: code review of 2-1-collection-list-metadata-extraction (2026-04-12)

- **Abstract field no length cap** (`bootstrap.js` `_buildMetadataBlock`): Full `abstractNote` appended verbatim; could inflate API payload. Address in Story 2.2 when constructing the Claude API request (truncate or cap abstract length).
- **Duplicate collection names in `collectionMap`**: `collectionMap.set(col.name, col.id)` silently overwrites when two collections share a name. Low real-world risk for typical Zotero libraries. If it becomes a problem, switch to `Map<name, id[]>` and handle ambiguity in Story 2.2.
- **Case-sensitive exclusion matching**: `excluded.includes(col.name)` is case-sensitive. If a user types `"00-Inbox"` but the collection is `"00-inbox"`, it won't be excluded. Consider `.toLowerCase()` normalization in a future polish pass.
- **Empty `collectionMap` after filtering**: If all collections are excluded, `collectionMap` is empty and Story 2.2 will proceed to an API call with no candidates. Story 2.2 must guard against this (early-return + `_notify("No candidate collections available")`).
