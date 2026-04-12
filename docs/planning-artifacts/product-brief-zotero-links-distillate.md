---
title: "Product Brief Distillate: zotero-links Smart Auto-Assign"
type: llm-distillate
source: "product-brief-zotero-links.md"
created: "2026-04-12"
purpose: "Token-efficient context for downstream PRD creation"
---

## Feature Identity

- Feature name: **Smart Auto-Assign**
- Plugin: `zotero-links` — Zotero 7/8 bootstrap plugin (2-file architecture: `manifest.json` + `bootstrap.js`)
- Feature type: internal tool / personal productivity enhancement
- Target version: v1 (single-item, metadata-only)

## User & Workflow Context

- Single user: researcher/knowledge worker with structured Zotero collection hierarchy (10–50 collections, hundreds of items)
- Inbox collection is specifically named `00-inbox` — this is the user's actual setup, not a generic example
- Workflow: capture-first (everything goes to `00-inbox`), categorize later in a manual pass
- Pain: manual categorization is slow, scales poorly, context decays when items sit too long
- User is comfortable with plugin installation and API key configuration

## Core Behavior (v1)

- Trigger: right-click on a single item → "Auto-assign to collections" menu item on `#zotero-itemmenu`
- Input to LLM: item metadata only — title, authors, abstract, year, tags, item type, journal/publisher
- Collection list passed to LLM: all collections in the current library **excluding `00-inbox` itself** (important — do not suggest inbox as a target)
- LLM output: up to 3 collection names from the provided list
- Assignment: silent, no confirmation dialog, no undo UI — user fixes mistakes manually
- Plugin does not create new collections — only assigns to existing ones

## LLM / API Details

- Provider: **Claude API only** (Anthropic) — no multi-provider support in v1
- Model preference: cost-efficient model (e.g., `claude-haiku-4-5-20251001`) — keep per-call token count small
- API key: stored via `Services.prefs` at key `extensions.zotero-links.claudeApiKey`
- API key configuration: exposed through **Zotero plugin preferences pane** (option b — not a dialog, not a one-time prompt, not manual config editor)
- Network: use `fetch()` — available in Gecko 115+ (Zotero 7/8 baseline), no polyfill needed
- Collection assignment: `item.addToCollection(collectionID)` followed by `item.saveTx()`

## Rejected Ideas & Rationale (do not re-propose without new justification)

- **Attachment text extraction in v1** — rejected: too expensive for large items (especially books); clean metadata is sufficient for most cases. Deferred to v2.
- **URL/link content fetching in v1** — rejected: same cost concern; paywalled and JS-rendered pages are unreliable anyway. Deferred to v2.
- **Batch processing in v1** — rejected: test single-item behavior first, validate accuracy before scaling. Deferred to v2.
- **Claude Code skill as the classification interface** — rejected: requires context-switching outside Zotero; in-plugin approach keeps the feature accessible during normal library sessions.
- **Confirmation dialog before assigning** — rejected: zero-friction is a deliberate design principle; cost of a wrong assignment < cost of reviewing every assignment.
- **Multi-provider LLM support** — rejected for v1 scope simplicity.
- **Creating new collections from LLM suggestions** — rejected: too unpredictable; taxonomy must stay user-controlled.

## Technical Constraints (from existing plugin architecture)

- Do NOT use `.jsm` modules — replaced by `.sys.mjs` in Gecko 115+
- `Zotero`, `Services`, `Components` are globals in `bootstrap.js` — do not import them
- Use `doc.createXULElement(...)` for XUL elements, not `document.createElement`
- Clipboard only via XPCOM `nsIClipboardHelper` (existing pattern in codebase)
- New menu items follow the pattern: `_addXxxMenuItem(win)`, called from `addToWindow(win)`, IDs registered in `addedElementIDs` for cleanup
- Plugin lifecycle: `startup()` / `onMainWindowLoad` / `onMainWindowUnload` / `shutdown()`

## Scope Boundaries (v1)

| In | Out |
|----|-----|
| Single item auto-assign | Batch / multi-item |
| Metadata-only classification | Attachment text extraction |
| Claude API | URL content fetching |
| Up to 3 collections assigned | Undo history |
| Preferences pane for API key | Custom prompt configuration |
| Silent assignment | Suggestion review UI |

## Roadmap Signals

- **v2:** Attachment text extraction (PDF), URL content fetching for web-page item types
- **v3+:** Batch inbox clearing, proactive classification on item add, feedback loop from manual corrections influencing future prompts

## Open Questions for PRD

- Exact preferences pane implementation: Zotero uses `options` / `optionsURL` in `manifest.json` pointing to an HTML preferences page — needs design for the API key input field
- Error handling UX: what does the user see if the API key is missing, the API call fails, or no matching collections are found? (Not defined in brief — needs spec)
- Should `00-inbox` be hardcoded or configurable? (Currently assumed hardcoded as the exclusion target — user may want to configure it)
- LLM prompt design: not specified — needs careful engineering to ensure JSON-parseable collection name output and graceful handling of unknown collections hallucinated by the model
