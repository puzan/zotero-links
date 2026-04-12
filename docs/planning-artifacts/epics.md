---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
---

# zotero-links - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for zotero-links, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The user can trigger auto-assignment for a single selected item via a right-click context menu action.
FR2: The system can extract all available metadata fields from a Zotero item (title, authors, abstract, year, tags, item type, journal/publisher name).
FR3: The system can send item metadata and the current library's collection names to the Claude API and receive a classification response.
FR4: The system can validate that all collection names returned by the API exist in the current library before assigning.
FR5: The system can assign the item to up to 3 validated collections silently, without a confirmation dialog.
FR6: The system can handle items with incomplete or sparse metadata by using all available fields and gracefully proceeding with the API call.
FR7: The system can retrieve the full list of collections from the current Zotero library.
FR8: The system can exclude the `00-inbox` collection from the list of candidate collections passed to the API.
FR9: The system can resolve collection names returned by the API to their corresponding Zotero collection IDs for assignment.
FR10: The user can view and edit the Claude API key in the Zotero plugin preferences pane.
FR11: The system can read the stored API key at classification time from plugin preferences.
FR12: When the API key is not configured and the user triggers auto-assignment, the system can open the preferences pane directly.
FR13: The system can notify the user when no matching collection is found for the item.
FR14: The system can notify the user when the Claude API is unreachable due to a network error.
FR15: The system can notify the user when the Claude API returns a non-success response (4xx/5xx).
FR16: All error paths leave the item unchanged — no partial or incorrect assignment on failure.
FR17: The auto-assign menu item is injected into `#zotero-itemmenu` following the existing `_addXxxMenuItem(win)` pattern.
FR18: The menu item is available whenever a single item is selected (consistent with existing item menu behavior).
FR19: The menu item and all associated elements are cleaned up on window unload and plugin shutdown.
FR20: The plugin remains stable and all existing menu items continue to function after the new feature is added.

### NonFunctional Requirements

NFR1: The auto-assign operation (API call + assignment) completes within 5 seconds under normal network conditions.
NFR2: The context menu appears with no perceptible delay on right-click — the new menu item adds zero visible latency.
NFR3: Collection list retrieval completes in under 500ms.
NFR4: The Claude API key is stored via `Services.prefs` and is never logged, printed to console, or included in error messages.
NFR5: Item metadata is transmitted to the Claude API over HTTPS only. No plaintext transmission.
NFR6: The plugin does not store or cache item metadata beyond the duration of a single classification call.
NFR7: A failure in the auto-assign flow (network error, API error, no match) must not affect the stability of the Zotero session or the behavior of existing plugin features.
NFR8: The plugin passes Zotero's extension validation and installs cleanly alongside other plugins without conflicts.
NFR9: The new menu item is fully cleaned up on window unload and plugin shutdown with no resource leaks.

### Additional Requirements

- No starter template applies — this is a brownfield addition to the existing 2-file plugin; implementation starts directly with feature code.
- New file required: `options.html` — plugin preferences pane (API key + excluded collections). Declared in `manifest.json` via `options_ui: { page: "options.html" }`.
- `manifest.json` must be updated with `options_ui` entry; exact key must be verified against a Zotero 8 plugin example before writing.
- Plugin version must be bumped to `0.3.0` in `manifest.json`.
- Preference defaults must be initialized in `startup()`: `extensions.zotero-links.excludedCollections` defaults to `"00-inbox"`.
- All injected DOM elements must be registered in `ZoteroLinks.addedElementIDs` immediately after creation to ensure proper cleanup.
- `_notify(msg)` is the single notification surface for all user-facing messages — no `Zotero.alert()` or bare `console.error()`.
- Async event handler pattern: fire-and-forget `_autoAssignItem(item).catch(err => _notify(...))` — never `async` directly on the handler.
- `item.saveTx()` must be called after every `item.addToCollection()`.
- Response validation: every API-returned collection name must be cross-referenced against the live collection list before assignment — unrecognized names silently dropped.
- Claude API payload: model `claude-haiku-4-5-20251001`, `max_tokens: 256`, metadata as plain text block (omit empty fields), system prompt constraining output to a JSON array of names from the provided list.
- `build.sh` requires no changes — it zips all repo-root files including the new `options.html` automatically.

### UX Design Requirements

_No UX design document exists for this feature._

### FR Coverage Map

FR1:  Epic 2 — Context menu trigger for auto-assignment
FR2:  Epic 2 — Metadata extraction from Zotero item
FR3:  Epic 2 — Claude API call with metadata + collection list
FR4:  Epic 2 — Response validation (names must exist in library)
FR5:  Epic 2 — Silent assignment to up to 3 validated collections
FR6:  Epic 2 — Graceful handling of sparse/incomplete metadata
FR7:  Epic 2 — Retrieve full collection list from library
FR8:  Epic 2 — Exclude 00-inbox from candidate collections
FR9:  Epic 2 — Resolve collection names to IDs
FR10: Epic 1 — API key field in preferences pane
FR11: Epic 1 — Read stored API key at classification time
FR12: Epic 1 — Open preferences pane when key is missing
FR13: Epic 2 — Notify user: no matching collection found
FR14: Epic 2 — Notify user: network unreachable
FR15: Epic 2 — Notify user: API error (4xx/5xx)
FR16: Epic 2 — Item unchanged on all error paths
FR17: Epic 1 — Menu item injected into #zotero-itemmenu
FR18: Epic 1 — Menu item available when single item selected
FR19: Epic 1 — Cleanup on window unload and plugin shutdown
FR20: Epic 1 — Existing menu items unaffected

## Epic List

### Epic 1: Auto-Assign Entry Point & Configuration
The user can see the "Auto-assign to collections" menu item in Zotero, configure their Claude API key via the preferences pane, and be guided there automatically if the key is missing.
**FRs covered:** FR10, FR11, FR12, FR17, FR18, FR19, FR20

### Epic 2: Intelligent Item Classification
The user right-clicks a single item, triggers auto-assignment, and the item is silently placed in up to 3 matching collections — with clear feedback in all cases (success, no match, network error, API error).
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR13, FR14, FR15, FR16

---

## Epic 1: Auto-Assign Entry Point & Configuration

The user can configure their Claude API key via the preferences pane and see the "Auto-assign to collections" menu item in Zotero, with the plugin guiding them to preferences if the key is missing.

### Story 1.1: Plugin Preferences Pane

As a Zotero user,
I want to view and edit my Claude API key (and excluded collections) in the Zotero plugin preferences pane,
So that I can configure the auto-assign feature without editing any files manually.

**Acceptance Criteria:**

**Given** the plugin is installed
**When** the user opens Zotero → Tools → Add-ons → zotero-links preferences
**Then** a preferences pane opens with a labeled "Claude API Key" password field and an "Excluded Collections" text field (default: `00-inbox`)
**And** changes to either field are persisted to `Services.prefs` at `extensions.zotero-links.claudeApiKey` and `extensions.zotero-links.excludedCollections`

**Given** the plugin starts up for the first time (no prefs set)
**When** `startup()` executes
**Then** `extensions.zotero-links.excludedCollections` is initialized to `"00-inbox"` if not already set
**And** `extensions.zotero-links.claudeApiKey` defaults to `""`

*Fulfills: FR10 | Additional requirements: `options.html`, `manifest.json` `options_ui` entry, version bump to 0.3.0, pref defaults in `startup()`*

### Story 1.2: Auto-Assign Menu Item & Plugin Lifecycle

As a Zotero user,
I want to see an "Auto-assign to collections" item in the right-click menu when I select a single item,
So that I can trigger auto-assignment and be guided to preferences if my API key is not yet configured.

**Acceptance Criteria:**

**Given** a single item is selected in the Zotero library
**When** the user right-clicks to open the item context menu
**Then** an "Auto-assign to collections" menu item appears in `#zotero-itemmenu`
**And** the menu opens with no perceptible delay (zero added latency)

**Given** the "Auto-assign to collections" menu item is clicked
**When** the Claude API key preference (`extensions.zotero-links.claudeApiKey`) is empty
**Then** the Zotero preferences pane opens directly to the zotero-links settings page
**And** no assignment attempt is made

**Given** the plugin is active across multiple windows
**When** a window is closed or the plugin is shut down
**Then** all injected menu elements (registered in `addedElementIDs`) are removed cleanly with no resource leaks

**Given** the new menu item is added
**When** the user uses the existing "Copy Collection Link" or "Copy Item Link" menu items
**Then** both continue to function exactly as before

*Fulfills: FR11, FR12, FR17, FR18, FR19, FR20*

---

## Epic 2: Intelligent Item Classification

The user right-clicks a single item, triggers auto-assignment, and the item is silently placed in up to 3 matching collections — with clear feedback in all cases (success, no match, network error, API error).

### Story 2.1: Collection List & Metadata Extraction

As a Zotero user,
I want the plugin to gather the current library's collections and extract the selected item's metadata,
So that both are ready to send to the Claude API for classification.

**Acceptance Criteria:**

**Given** `_autoAssignItem(item)` is invoked
**When** it reads the library's collection list
**Then** all collections from `Zotero.Collections.getByLibrary(libraryID)` are retrieved
**And** collections whose names appear in the `excludedCollections` pref (comma-separated, trimmed) are removed from the candidate list
**And** a name→ID map is built from the remaining collections
**And** the retrieval completes in under 500ms

**Given** a Zotero item with complete metadata
**When** the metadata block is constructed
**Then** it includes all available fields as plain text: Title, Authors, Abstract, Year, Item type, Journal/Publisher, Tags
**And** fields with no value are omitted entirely

**Given** a Zotero item with sparse metadata (e.g., only a title)
**When** the metadata block is constructed
**Then** only the available fields are included
**And** execution continues to the API call without error

*Fulfills: FR2, FR6, FR7, FR8, FR9*

### Story 2.2: Claude API Classification & Silent Assignment

As a Zotero user,
I want the plugin to send the item metadata to Claude and silently assign the item to matching collections,
So that categorization happens without any review dialog or manual action on my part.

**Acceptance Criteria:**

**Given** a valid API key and a non-empty collection candidate list
**When** `_autoAssignItem` calls the Claude API
**Then** a POST is made to `https://api.anthropic.com/v1/messages` over HTTPS with the `x-api-key` header
**And** the payload uses model `claude-haiku-4-5-20251001`, `max_tokens: 256`, the system prompt constraining output to a JSON array, and the metadata + collection names in the user message
**And** the API key is never included in any log, error message, or string other than the `x-api-key` header

**Given** the Claude API returns a JSON array of collection names
**When** the response is parsed
**Then** each returned name is cross-referenced against the candidate collection name→ID map
**And** names not present in the map are silently dropped
**And** `item.addToCollection(id)` + `item.saveTx()` is called for each validated collection (up to 3)
**And** no confirmation dialog is shown — assignment is silent

**Given** the item is successfully assigned to at least one collection
**When** assignment completes
**Then** a `Zotero.ProgressWindow` notification confirms the result
**And** item metadata is not retained after the call completes (no caching)

*Fulfills: FR1, FR3, FR4, FR5 | NFR1, NFR4, NFR5, NFR6*

### Story 2.3: Error Handling & User Feedback

As a Zotero user,
I want the plugin to notify me clearly when auto-assignment cannot complete,
So that I always know what happened and my item is never silently left in a wrong state.

**Acceptance Criteria:**

**Given** the Claude API returns a non-empty array but none of the names match any collection in the library
**When** validation completes
**Then** a `_notify("No matching collection found")` message appears
**And** no `addToCollection` call is made and the item remains unchanged

**Given** `fetch()` throws a network error or times out
**When** the API call fails
**Then** `_notify("Could not reach Claude API — check your connection")` is shown
**And** the item remains unchanged

**Given** the Claude API returns a 4xx or 5xx HTTP status
**When** the response is checked
**Then** `_notify("Claude API returned an error — check your API key")` is shown
**And** the item remains unchanged

**Given** an unexpected exception propagates out of `_autoAssignItem`
**When** the outer `.catch()` on the fire-and-forget handler catches it
**Then** `_notify("Unexpected error: " + err.message)` is shown
**And** the Zotero session is unaffected — no crash, no broken existing menu items

*Fulfills: FR13, FR14, FR15, FR16 | NFR7*
