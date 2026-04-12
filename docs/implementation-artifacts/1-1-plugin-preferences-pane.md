# Story 1.1: Plugin Preferences Pane

Status: ready-for-dev

## Story

As a Zotero user,
I want to view and edit my Claude API key and excluded collections list in the Zotero plugin preferences pane,
so that I can configure the auto-assign feature without editing any files manually.

## Acceptance Criteria

1. **Given** the plugin is installed, **When** the user opens Zotero → Tools → Add-ons → zotero-links preferences, **Then** a preferences pane opens with a labeled "Claude API Key" password input field and an "Excluded Collections" text input field showing the current value (default: `00-inbox`).

2. **Given** the user edits the "Claude API Key" field, **When** they make a change, **Then** the value is persisted to `Services.prefs` at `extensions.zotero-links.claudeApiKey`.

3. **Given** the user edits the "Excluded Collections" field, **When** they make a change, **Then** the value is persisted to `Services.prefs` at `extensions.zotero-links.excludedCollections`.

4. **Given** the plugin starts up for the first time (no prefs set), **When** `startup()` executes, **Then** `extensions.zotero-links.excludedCollections` is initialized to `"00-inbox"` if not already set, and `extensions.zotero-links.claudeApiKey` defaults to `""` if not already set.

## Tasks / Subtasks

- [ ] Task 1: Verify manifest.json `options_ui` key for Zotero 8 and update manifest (AC: 1)
  - [ ] Subtask 1.1: Research the correct manifest.json key for preferences pane in Zotero 8 (candidates: `options_ui`, `options_url`, `optionsURL`) by checking a known-working Zotero 8 plugin
  - [ ] Subtask 1.2: Add verified `options_ui` entry to `manifest.json` with `"page": "options.html"`
  - [ ] Subtask 1.3: Bump version in `manifest.json` from `"0.1.0"` to `"0.3.0"`

- [ ] Task 2: Create `options.html` preferences pane (AC: 1, 2, 3)
  - [ ] Subtask 2.1: Create `options.html` at repo root with Claude API Key password field and Excluded Collections text field
  - [ ] Subtask 2.2: On page load, populate both fields from `Services.prefs` using `getCharPref(key, default)`
  - [ ] Subtask 2.3: On input change (use `input` event), persist value back to `Services.prefs` using `setCharPref`

- [ ] Task 3: Initialize preference defaults in `startup()` (AC: 4)
  - [ ] Subtask 3.1: In `startup()` in `bootstrap.js`, initialize `extensions.zotero-links.excludedCollections` to `"00-inbox"` if `prefHasUserValue` returns false
  - [ ] Subtask 3.2: In `startup()`, initialize `extensions.zotero-links.claudeApiKey` to `""` if not already set

## Dev Notes

### Critical: Verify manifest.json Key Before Writing

The architecture doc flags this as a known risk (Gap Analysis section): Zotero 8's exact `manifest.json` key for preferences pane URL may be `options_ui`, `options_url`, or `optionsURL`. **Before writing the manifest entry, check a working Zotero 8 plugin** (e.g., search GitHub for `"options_ui"` in `manifest.json` files of Zotero plugins, or check the Zotero plugin documentation). The architecture decision uses `options_ui: { page: "options.html", open_in_tab: false }` but this must be confirmed.

[Source: docs/planning-artifacts/architecture.md#Gap Analysis Results]

### manifest.json Changes

Current `manifest.json` (version `"0.1.0"`) must be updated:
- Bump `"version"` to `"0.3.0"` (skipping 0.2.0 per PRD requirement)
- Add `options_ui` entry (or verified equivalent key) at top level

```json
"options_ui": {
  "page": "options.html",
  "open_in_tab": false
}
```

[Source: docs/planning-artifacts/architecture.md#manifest.json — required addition]

### options.html Structure and Pattern

`options.html` is created at **repo root** (same level as `manifest.json` and `bootstrap.js`). The `build.sh` script zips all non-gitignored repo root files, so `options.html` is included automatically — no build script changes needed.

`options.html` must:
- Use `Services.prefs` directly via inline `<script>` — **no imports, no shared code with `bootstrap.js`**
- Read prefs on page load using `getCharPref(key, defaultValue)` — always provide the default
- Write prefs on input change using `setCharPref(key, value)`
- Have exactly two fields:
  1. `claudeApiKey` — `<input type="password">` for the API key
  2. `excludedCollections` — `<input type="text">` with placeholder `"00-inbox"`

`Services` is a global in the Gecko extension context — available in `options.html` without import.

**Preference keys:**
- `extensions.zotero-links.claudeApiKey` (default: `""`)
- `extensions.zotero-links.excludedCollections` (default: `"00-inbox"`)

[Source: docs/planning-artifacts/architecture.md#Data Architecture, #Preferences Pane Boundary]

### startup() Pref Initialization Pattern

In `bootstrap.js`, inside `startup({ id, version, rootURI })`, **before** `ZoteroLinks.addToAllWindows()` is called, add pref defaults:

```js
// Initialize pref defaults
if (!Services.prefs.prefHasUserValue("extensions.zotero-links.excludedCollections")) {
  Services.prefs.setCharPref("extensions.zotero-links.excludedCollections", "00-inbox");
}
if (!Services.prefs.prefHasUserValue("extensions.zotero-links.claudeApiKey")) {
  Services.prefs.setCharPref("extensions.zotero-links.claudeApiKey", "");
}
```

[Source: docs/planning-artifacts/architecture.md#Pref Initialization in startup()]

### Always Use Default in getCharPref

```js
// Correct
Services.prefs.getCharPref("extensions.zotero-links.excludedCollections", "00-inbox")

// Wrong — throws if pref not set
Services.prefs.getCharPref("extensions.zotero-links.excludedCollections")
```

[Source: docs/planning-artifacts/architecture.md#Preferences Read Pattern]

### Naming Conventions

Preference keys: always `extensions.zotero-links.<camelCaseName>`

[Source: docs/planning-artifacts/architecture.md#Naming Patterns]

### No Tests Required

Architecture decision: no test framework exists; this is a single-developer personal tool. No tests are written for this story.

[Source: docs/planning-artifacts/architecture.md#Testing]

### Project Structure Notes

- `options.html` → repo root (alongside `manifest.json` and `bootstrap.js`)
- `manifest.json` → repo root, modified in place
- `bootstrap.js` → repo root, `startup()` function modified

No new directories. No new JS modules. `build.sh` requires no changes.

```
zotero-links/
├── manifest.json        ← modify: add options_ui + bump version to 0.3.0
├── bootstrap.js         ← modify: add pref defaults in startup()
├── options.html         ← NEW: preferences pane
└── build.sh             ← unchanged
```

[Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]

### References

- [Source: docs/planning-artifacts/architecture.md#API Key Storage]
- [Source: docs/planning-artifacts/architecture.md#Preferences Storage Keys]
- [Source: docs/planning-artifacts/architecture.md#Frontend Architecture — options.html]
- [Source: docs/planning-artifacts/epics.md#Story 1.1]
- [Source: docs/planning-artifacts/architecture.md#File Organization Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
