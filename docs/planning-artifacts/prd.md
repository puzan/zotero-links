---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
classification:
  projectType: desktop_app
  domain: general
  complexity: low
  projectContext: brownfield
inputDocuments:
  - docs/planning-artifacts/product-brief-zotero-links.md
  - docs/planning-artifacts/product-brief-zotero-links-distillate.md
  - docs/project-context.md
workflowType: 'prd'
---

# Product Requirements Document — zotero-links: Smart Auto-Assign

**Author:** Ilya
**Date:** 2026-04-12

## Executive Summary

**Smart Auto-Assign** is a new feature for the `zotero-links` Zotero 7/8 plugin that eliminates the manual categorization bottleneck in personal research libraries. Heavy Zotero users accumulate items faster than they can organize them — the common workaround is an inbox-first workflow where everything lands in a holding collection and categorization happens in a separate, tedious pass. Smart Auto-Assign removes that pass: right-click a single item, select "Auto-assign to collections", and an AI model reads the item's metadata and silently places it into up to three best-fit collections from your existing taxonomy. No review dialog, no confirmation, no friction.

The feature targets a single user: a researcher or knowledge worker maintaining a personal Zotero library with a structured collection hierarchy (10–50 collections, hundreds of items) and a `00-inbox` capture-first workflow. This is a brownfield addition to the existing `zotero-links` plugin (v0.2.0).

### What Makes This Special

Most smart-suggest tools require the user to approve every recommendation. Smart Auto-Assign deliberately skips that step. The core design principle: the cost of an occasional wrong assignment is lower than the cost of reviewing every correct one. This is only viable for a single-user personal tool — and that constraint is what makes the zero-friction philosophy feasible.

The user's collection taxonomy is already the right classification schema. The LLM doesn't invent categories or run topic models — it routes items against a list of collection names the user already built. Suggestions are always grounded in something real and existing. The plugin never creates new collections.

Cost is contained by design: v1 classifies on metadata only (title, authors, abstract, year, tags, item type, journal/publisher), keeping each API call to a few hundred tokens with no attachment parsing or URL fetching.

## Success Criteria

### User Success

- **Accuracy:** ≥70% of auto-assigned collections are correct without manual correction. Wrong assignments are cheap to fix; the bar is set where the feature saves more time than the corrections cost.
- **Speed:** Categorization throughput increases from ~1 item/minute (manual drag-and-drop) to tens of items/minute. A backlog of dozens of inbox items clears in under 5 minutes.
- **Adoption:** The user reaches for "Auto-assign to collections" reflexively within 20 uses, without defaulting to manual categorization as the first instinct.

### Business Success

This is a personal productivity tool with no revenue or growth metrics. Success is the user's own experience of friction reduction. The feature succeeds if it materially changes the inbox-clearing workflow: less time spent, less context decay from items sitting too long, and no regression in library quality.

### Technical Success

- API call succeeds for all common item types: journal articles, books, web pages, conference papers, reports.
- Each classification call completes within 5 seconds under normal network conditions.
- API key configuration via preferences pane works without requiring manual config file editing.
- Plugin remains stable — no crashes, no broken existing menu items after the new feature is added.
- Items with incomplete metadata are handled gracefully — all available fields are used, and the user is notified if no match can be made. No silent failures.

### Measurable Outcomes

| Outcome | Target |
|---|---|
| Assignment accuracy | ≥70% correct, no correction needed |
| Throughput improvement | ≥10x vs manual (tens/min vs ~1/min) |
| Time to reflexive adoption | Within 20 uses |
| Supported item types | Articles, books, web pages, reports (minimum) |
| Sparse/incomplete metadata | Use all available fields; notify user "No matching collection found" if no match |

## User Journeys

### Journey 1: Clearing the Inbox (Happy Path)

Ilya has been collecting papers for two weeks. His `00-inbox` has 34 items. He sits down for a categorization pass — the kind he usually dreads.

He right-clicks the first item, a journal article on transformer architectures. He selects "Auto-assign to collections." No dialog appears. Half a second later, the item has moved — it's now in `ML/Architectures` and `NLP`. He checks: both are correct.

He works through the next 30 items the same way. A few need a manual tweak — one article got placed in `Systems` instead of `Distributed Systems`, which he corrects with a drag. The pass that used to take 40 minutes is done in under 5. He closes Zotero and gets back to reading.

**Capabilities revealed:** context menu item, metadata extraction, Claude API call, silent multi-collection assignment, stable plugin lifecycle.

---

### Journey 2: Item With No Good Match

Ilya right-clicks a web page clipped from a news site. The title is "Weekly roundup" and there's no abstract. He selects "Auto-assign to collections."

A small notification appears: "No matching collection found." Nothing is assigned. Ilya glances at the item, manually drags it to `Reading/General`, and moves on. No crash, no spinner that hangs, no silent wrong assignment.

**Capabilities revealed:** graceful no-match handling with user notification, use of all available metadata fields even when sparse, no silent failure.

---

### Journey 3: First-Time Setup

Ilya has just installed the new version of `zotero-links` with Smart Auto-Assign. He right-clicks an item and sees the new "Auto-assign to collections" menu item. He clicks it.

The Zotero preferences pane opens directly to the zotero-links plugin settings. There's a single labeled field: "Claude API Key." Ilya pastes his key, closes the pane, and right-clicks the same item again. This time, the assignment happens silently as expected.

**Capabilities revealed:** preferences pane with API key field, detection of missing key before API call, direct navigation to preferences on first use.

---

### Journey Requirements Summary

| Capability | Revealed By |
|---|---|
| Context menu item on `#zotero-itemmenu` | Journeys 1, 2, 3 |
| Metadata extraction (all available fields) | Journeys 1, 2 |
| Claude API call with collection list | Journey 1 |
| Silent multi-collection assignment | Journey 1 |
| "No matching collection found" notification | Journey 2 |
| Missing API key → open preferences pane | Journey 3 |
| API key field in plugin preferences pane | Journey 3 |

## Innovation & Novel Patterns

### Detected Innovation Areas

**AI-assisted desktop workflow automation** — Smart Auto-Assign embeds LLM-based classification directly into a desktop research tool's context menu, making AI assistance a zero-friction part of the normal Zotero session.

**"Apply + correct" UX pattern** — The feature deliberately inverts the dominant "suggest + approve" pattern used by most AI-assist tools. Assignment happens immediately and silently; the user corrects exceptions rather than reviewing every suggestion. This pattern is only viable for personal, single-user tools where the user has full editorial control and the cost of an occasional wrong assignment is lower than the overhead of universal review.

**Taxonomy-grounded classification** — Instead of open-ended topic modeling, the LLM is constrained to the user's existing collection names. It acts as a router, not a classifier — which makes outputs more predictable, eliminates hallucinated categories, and keeps the user's organizational system fully under their control.

### Validation Approach

- Accuracy validated empirically: user tracks how many auto-assignments require manual correction over first 20 uses.
- Latency validated by feel: no spinner or perceptible hang on right-click.
- Adoption validated by behavior: does the user reach for "Auto-assign" without thinking about it?

## Technical Architecture

### Overview

`zotero-links` is a Zotero 7/8 bootstrap plugin — a two-file XPI (`manifest.json` + `bootstrap.js`) running in Gecko 115+. Smart Auto-Assign extends this plugin with a new context menu item, an outbound HTTPS call to the Claude API, and a plugin preferences pane. No new files or build tooling are required beyond the existing pattern.

### Platform Support

| Platform | Support |
|---|---|
| Windows | Supported — no platform-specific code |
| macOS | Supported — no platform-specific code |
| Linux | Supported — no platform-specific code |

Implementation uses only Gecko globals (`Zotero`, `Services`, `Components`, `fetch()`) — cross-platform by construction.

### System Integration

**Zotero internals:**
- `Zotero.Collections.getByLibrary(libraryID)` — retrieve full collection list for current library
- `item.addToCollection(collectionID)` + `item.saveTx()` — assign item to collection
- `Services.prefs` at key `extensions.zotero-links.claudeApiKey` — read/write API key
- `Zotero.getActiveZoteroPane().getSelectedItems()` — retrieve the selected item on right-click

**Claude API:**
- Endpoint: `https://api.anthropic.com/v1/messages`
- Transport: `fetch()` (Gecko 115+, no polyfill needed)
- Auth: `x-api-key` header
- Model: `claude-haiku-4-5-20251001` (cost-efficient, small payload)
- Payload: metadata-only JSON, collection name list, classification prompt
- Response: JSON array of up to 3 collection names from the provided list

### Error Handling

All error paths surface a notification and leave the item unchanged:

| Condition | User-facing message |
|---|---|
| API key not configured | Opens preferences pane directly |
| Network unreachable / API timeout | "Could not reach Claude API — check your connection" |
| API error (4xx/5xx) | "Claude API returned an error — check your API key" |
| No matching collection found | "No matching collection found" |

### Update Strategy

No change from existing pipeline. Auto-update is handled by `updates.json` published to GitHub Releases, referenced via `update_url` in `manifest.json`.

## Project Scoping & Phased Development

### MVP Strategy

**Approach:** Problem-solving MVP — the minimum that makes the inbox-clearing workflow materially faster. Validates accuracy and adoption before any scope expansion.

**Resource:** Single developer. No external dependencies beyond Claude API access and a Zotero test environment.

### Phase 1 — MVP

**Supported journeys:** All three (happy path, no match, first-time setup).

**Capabilities:**
- Context menu item "Auto-assign to collections" on `#zotero-itemmenu` (single item only)
- Metadata extraction: title, authors, abstract, year, tags, item type, journal/publisher (all available fields)
- Collection list from current library, excluding `00-inbox`
- Claude API call via `fetch()` with carefully engineered classification prompt
- Response validation: returned collection names must exist in the provided list
- Silent assignment to up to 3 validated collections
- API key field in Zotero plugin preferences pane (HTML options page)
- Full error notification coverage: missing key, network failure, API error, no match

### Phase 2 — Growth

- Attachment text extraction for PDF and EPUB items
- URL/link content fetching for web-page item types
- Batch processing — multiple inbox items in a single operation
- Configurable inbox exclusion (user-settable instead of hardcoded `00-inbox`)

### Phase 3 — Expansion

- Proactive classification on item add — zero-touch inbox
- Feedback loop from manual corrections influencing future prompts
- Custom prompt configuration for power users

### Risk Mitigation

**Technical risks:**
- *Preferences pane implementation* — Zotero's HTML options page pattern is new to this plugin. Mitigation: research `manifest.json` `options`/`optionsURL` pattern before coding; well-documented in Zotero plugin examples.
- *LLM prompt engineering* — Prompt must produce clean, validated collection name output. Mitigation: constrain prompt to return only names from the provided list as a JSON array; validate every returned name against actual collection IDs before assigning.

**Accuracy risk:** If <70% accuracy threshold isn't met, the feature creates more work than it saves. Mitigation: test on a sample of 20 real inbox items before shipping; tune prompt if accuracy is low.

**Resource risk:** Single developer, no contingency. If a phase gets complex, defer to the next phase — scope boundaries are already clean.

## Functional Requirements

### Item Classification

- **FR1:** The user can trigger auto-assignment for a single selected item via a right-click context menu action.
- **FR2:** The system can extract all available metadata fields from a Zotero item (title, authors, abstract, year, tags, item type, journal/publisher name).
- **FR3:** The system can send item metadata and the current library's collection names to the Claude API and receive a classification response.
- **FR4:** The system can validate that all collection names returned by the API exist in the current library before assigning.
- **FR5:** The system can assign the item to up to 3 validated collections silently, without a confirmation dialog.
- **FR6:** The system can handle items with incomplete or sparse metadata by using all available fields and gracefully proceeding with the API call.

### Collection Management

- **FR7:** The system can retrieve the full list of collections from the current Zotero library.
- **FR8:** The system can exclude the `00-inbox` collection from the list of candidate collections passed to the API.
- **FR9:** The system can resolve collection names returned by the API to their corresponding Zotero collection IDs for assignment.

### Plugin Configuration

- **FR10:** The user can view and edit the Claude API key in the Zotero plugin preferences pane.
- **FR11:** The system can read the stored API key at classification time from plugin preferences.
- **FR12:** When the API key is not configured and the user triggers auto-assignment, the system can open the preferences pane directly.

### Error & User Feedback

- **FR13:** The system can notify the user when no matching collection is found for the item.
- **FR14:** The system can notify the user when the Claude API is unreachable due to a network error.
- **FR15:** The system can notify the user when the Claude API returns a non-success response (4xx/5xx).
- **FR16:** All error paths leave the item unchanged — no partial or incorrect assignment on failure.

### Plugin Lifecycle & Integration

- **FR17:** The auto-assign menu item is injected into `#zotero-itemmenu` following the existing `_addXxxMenuItem(win)` pattern.
- **FR18:** The menu item is available whenever a single item is selected (consistent with existing item menu behavior).
- **FR19:** The menu item and all associated elements are cleaned up on window unload and plugin shutdown.
- **FR20:** The plugin remains stable and all existing menu items continue to function after the new feature is added.

## Non-Functional Requirements

### Performance

- **NFR1:** The auto-assign operation (API call + assignment) completes within 5 seconds under normal network conditions.
- **NFR2:** The context menu appears with no perceptible delay on right-click — the new menu item adds zero visible latency.
- **NFR3:** Collection list retrieval completes in under 500ms.

### Security

- **NFR4:** The Claude API key is stored via `Services.prefs` and is never logged, printed to console, or included in error messages.
- **NFR5:** Item metadata is transmitted to the Claude API over HTTPS only. No plaintext transmission.
- **NFR6:** The plugin does not store or cache item metadata beyond the duration of a single classification call.

### Reliability

- **NFR7:** A failure in the auto-assign flow (network error, API error, no match) must not affect the stability of the Zotero session or the behavior of existing plugin features.
- **NFR8:** The plugin passes Zotero's extension validation and installs cleanly alongside other plugins without conflicts.
- **NFR9:** The new menu item is fully cleaned up on window unload and plugin shutdown with no resource leaks.
