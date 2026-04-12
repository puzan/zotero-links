---
title: 'Weighted Collection Scoring'
type: 'feature'
created: '2026-04-12'
status: 'done'
baseline_commit: '2b5ffae'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current `assign_collections` tool returns only collection names with no confidence signal, so the plugin assigns any matched collection regardless of how well it fits the item.

**Approach:** Extend the tool schema to require each candidate to include a `weight` (0–1 float). After receiving the response, filter out candidates with `weight ≤ 0.7`, sort survivors descending by weight, then assign up to 3.

## Boundaries & Constraints

**Always:**
- Keep the structured-output tool approach (`tool_choice: { type: "tool", name: "assign_collections" }`)
- Validate each returned `name` against `collectionMap` before using it (existing hallucination guard must survive)
- All existing error paths (`_notify()`, early returns) remain unchanged
- Follow architecture patterns: no logging of API key, `item.saveTx()` after each `addToCollection()`

**Ask First:**
- If the threshold (0.7) needs to be made user-configurable via prefs — pause and ask before adding a pref key

**Never:**
- Accept items where `weight` is missing, null, or non-numeric — drop them silently
- Increase `max_tokens` beyond 1024 without user approval
- Change the model or API endpoint

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All candidates > 0.7 | 5 returned, all weight ≥ 0.8 | Top 3 by weight assigned | N/A |
| Mixed weights | 5 returned, 2 above 0.7, 3 below | Only 2 assigned | N/A |
| None above threshold | All weights ≤ 0.7 | `_notify("No matching collection found")` | N/A |
| Missing weight field | Item has no `weight` key | Drop that item silently, continue | N/A |
| Weight exactly 0.7 | `weight === 0.7` | Dropped (strictly greater than) | N/A |
| Tool returns empty array | `collections: []` | `_notify("No matching collection found")` | N/A |
| Name not in collectionMap | Valid weight but unknown name | Dropped by existing name-validation | N/A |

</frozen-after-approval>

## Code Map

- `bootstrap.js:282–305` -- `assign_collections` tool definition inside `_autoAssignItem` — schema change here
- `bootstrap.js:267–271` -- system prompt string — needs updated instructions
- `bootstrap.js:327–337` -- response parsing and validation — filtering/sorting logic added here
- `bootstrap.js:284` -- `max_tokens: 256` — increase to accommodate richer response objects

## Tasks & Acceptance

**Execution:**
- [x] `bootstrap.js` -- Update `assign_collections` tool schema: change `items` from `{ type: "string" }` to `{ type: "object", properties: { name: { type: "string" }, weight: { type: "number", minimum: 0, maximum: 1 } }, required: ["name", "weight"], additionalProperties: false }`. Remove `maxItems: 3` (LLM may return more candidates for filtering). Bump `max_tokens` from `256` to `512`.
- [x] `bootstrap.js` -- Update system prompt to instruct the model to return a `weight` (0–1) per collection reflecting confidence of fit, alongside the collection name.
- [x] `bootstrap.js` -- Replace the name-array extraction and validation block with: extract `toolUse.input.collections` as an array of `{ name, weight }` objects; drop items where `weight` is not a finite number; filter to `weight > 0.7`; sort descending by `weight`; slice to 3; validate each `name` against `collectionMap`; assign validated IDs.

**Acceptance Criteria:**
- Given the API returns candidates with mixed weights, when `_autoAssignItem` runs, then only collections with `weight > 0.7` are assigned, sorted highest-weight first, up to 3.
- Given all returned candidates have `weight ≤ 0.7`, when `_autoAssignItem` runs, then `_notify("No matching collection found")` is shown and no collections are assigned.
- Given a candidate is missing the `weight` field, when parsing the response, then that candidate is silently dropped and processing continues.
- Given the existing name-validation logic, when a name from the weighted list is not in `collectionMap`, then it is dropped regardless of weight.

## Design Notes

Updated tool schema (items shape only):
```js
items: {
  type: "object",
  properties: {
    name: { type: "string" },
    weight: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["name", "weight"],
  additionalProperties: false,
},
```

Updated filter/sort/slice logic:
```js
const candidates = toolUse?.input?.collections ?? [];
const validatedIDs = candidates
  .filter(c => typeof c.weight === "number" && isFinite(c.weight) && c.weight > 0.7)
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 3)
  .filter(c => collectionMap.has(c.name))
  .map(c => collectionMap.get(c.name));
```

## Spec Change Log

## Suggested Review Order

**API contract change (schema + prompt)**

- System prompt now requests weight alongside name — entry point for understanding the change
  [`bootstrap.js:267`](../../bootstrap.js#L267)

- Tool schema items changed from `string` to `{ name, weight }` object with `minimum`/`maximum`
  [`bootstrap.js:293`](../../bootstrap.js#L293)

- `max_tokens` bumped 256 → 512 to accommodate richer response objects
  [`bootstrap.js:284`](../../bootstrap.js#L284)

**Response filtering and selection logic**

- Weight filter (`> 0.7`), descending sort, slice to 3 — core of the new selection behavior
  [`bootstrap.js:333`](../../bootstrap.js#L333)

- Name validation against `collectionMap` still applied after weight/sort/slice — hallucination guard preserved
  [`bootstrap.js:337`](../../bootstrap.js#L337)

## Verification

**Commands:**
- `./build.sh` -- expected: exits 0, produces `zotero-links.xpi`

**Manual checks (if no CLI):**
- In Zotero: right-click an item → "Auto-assign to collections" → confirm notification shows assigned count or "No matching collection found"
- Enable debug logging pref and inspect the console to verify the raw Claude response includes `weight` fields
