---
title: 'Ancestor Deduplication for Collection Shortlist'
type: 'fix'
created: '2026-04-12'
status: 'done'
route: 'one-shot'
---

# Ancestor Deduplication for Collection Shortlist

## Intent

**Problem:** When Claude proposes both `a / b` and `a` as candidates, both collections are assigned. The parent `a` is redundant — `a / b` is more specific and sufficient.

**Approach:** After filtering by weight and sorting, remove any candidate whose path is a strict ancestor (string prefix) of another candidate in the list. The `collectionMap` full-path convention guarantees string-prefix equality equals actual Zotero hierarchy. Move the `collectionMap` name-validation before slicing so the deduplication step has access to the full sorted candidate pool — not just the top 3 — allowing the final slice to still yield up to 3 results.

## Suggested Review Order

**Core change — filter + dedup pipeline**

- Name validation moved before slice; ancestor removal step added; slice moved to end
  [`bootstrap.js:342`](../../bootstrap.js#L342)
