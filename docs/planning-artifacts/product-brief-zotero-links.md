---
title: "Product Brief: Smart Auto-Assign for zotero-links"
status: "complete"
created: "2026-04-12"
updated: "2026-04-12"
inputs: ["bootstrap.js", "docs/project-context.md", "CLAUDE.md", "user conversation"]
---

# Product Brief: Smart Auto-Assign

## Executive Summary

Organizing a personal research library in Zotero is a two-step ritual: collect now, categorize later. The "later" never gets easier — it's manual, repetitive, and scales poorly as a library grows. **Smart Auto-Assign** is a new feature for the `zotero-links` Zotero plugin that eliminates this bottleneck. Right-click an item in your inbox, select "Auto-assign to collections", and an AI model reads the item's metadata and places it into up to three best-fit collections — no confirmation dialogs, no friction. Mistakes are cheap to fix; the time saved is real.

This is a personal-productivity feature for a single-user Zotero plugin. Success is measured in how rarely the user needs to manually categorize items after the fact.

## The Problem

Heavy Zotero users accumulate items faster than they can organize them. The common workaround is an inbox-first approach: everything lands in a holding collection (e.g., `00-inbox`), and categorization happens in a separate pass. That pass requires:

1. Opening each item, reading enough to understand what it is
2. Scanning the collection tree to find the right home
3. Dragging or right-clicking to assign — repeated for every applicable collection
4. Repeating for dozens of items at a time

For a researcher with 10–50 collections and a library of hundreds of items, this becomes a non-trivial time tax. The pain compounds when items sit in inbox long enough that context is forgotten, requiring re-reading. The status quo is: most items stay in inbox too long, or get hastily mis-categorized just to clear the queue.

## The Solution

**Smart Auto-Assign** adds a new context menu action to the item right-click menu: **"Auto-assign to collections"**. When triggered:

1. The plugin assembles a classification payload from item metadata only: title, authors, abstract, year, tags, item type, and journal/publisher name.

2. This payload, together with the full list of collection names from the current library, is sent to the Claude API with a prompt asking it to select up to 3 best-fit collections.

3. The item is silently added to each suggested collection. No confirmation. The user removes any incorrect assignments manually.

**Metadata-first by design:** v1 intentionally omits attachment text extraction and URL content fetching. For many item types — especially books — those sources are expensive to process relative to the value they add. Clean metadata (title, abstract, tags) is sufficient for accurate classification in the vast majority of cases. Richer content sources are a planned v2 enhancement.

The plugin does not create new collections — it only assigns to existing ones. This keeps the feature grounded in the user's established organizational taxonomy.

## What Makes This Different

**Zero-friction philosophy:** Most categorization tools require the user to review, approve, or configure suggestions. Smart Auto-Assign skips all of that. The cost of an occasional wrong assignment is lower than the cost of reviewing every assignment. This is a deliberate design choice for a personal tool where the user has full editorial control.

**Grounded in the user's taxonomy:** The LLM works with actual collection names, not generic topic models. It cannot suggest a collection that doesn't exist, which means suggestions always map to something real and useful.

**Cost-controlled:** By classifying on metadata alone in v1, each API call is small and predictable — a few hundred tokens at most. No surprises from large PDFs or slow URL fetches.

## Who This Serves

**Primary user:** A researcher, academic, or knowledge worker who maintains a personal Zotero library with a structured collection hierarchy. They use an inbox collection as a capture-first buffer and spend meaningful time on categorization passes. They are comfortable installing and configuring browser-style plugins and willing to provide a Claude API key for AI features.

**Workflow fit:** This feature slots into the existing inbox-clearing workflow. It does not change how items are added — only how they move from inbox to their permanent homes.

## Success Criteria

- **Primary:** The `00-inbox` collection clears faster; categorization passes take materially less time per item.
- **Accuracy:** The majority of auto-assigned collections require no manual correction.
- **Adoption:** The user reaches for "Auto-assign" reflexively rather than manual drag-and-drop.
- **Reliability:** The feature handles all common item types (articles, books, web pages, reports) gracefully with metadata alone.

## Scope

**In for v1:**
- New context menu item: "Auto-assign to collections" on `#zotero-itemmenu`
- Metadata extraction: title, authors, abstract, year, tags, item type, journal/publisher
- Collection name list from current library (excluding `00-inbox` itself)
- LLM call to Claude API (claude-haiku-4-5 or similar, for cost efficiency)
- Silent assignment to up to 3 returned collections
- API key configuration via Zotero plugin preferences pane

**Out for v1:**
- Attachment text extraction (PDF, EPUB, etc.)
- URL/link content fetching
- Batch processing (multiple items at once) — v2
- Custom prompt configuration
- Support for providers other than Claude API
- Creating new collections based on LLM suggestions
- Undo history for auto-assignments
- UI for reviewing suggestions before applying

## Technical Approach

The implementation extends the existing `ZoteroLinks` bootstrap plugin pattern:
- New `_addAutoAssignMenuItem(win)` following existing menu item conventions
- New async helper `_autoAssignItem(item)`: metadata extraction → Claude API call → collection assignment
- API key stored via `Services.prefs` (`extensions.zotero-links.claudeApiKey`), configurable through Zotero's plugin preferences pane
- Network: `fetch()` available in Gecko 115+ for Claude API calls
- Collection reads: `Zotero.Collections.getByLibrary(libraryID)`
- Collection assignment: `item.addToCollection(collectionID)` + `item.saveTx()`

**Claude Code skill as alternative:** Using a Claude Code skill to trigger classification outside Zotero was considered. Ruled out for v1 — the in-plugin approach is accessible during the user's normal library session without context-switching, and requires no CLI interaction.

## Roadmap

| Version | Scope |
|---------|-------|
| v1 | Metadata-only classification, single item, Claude API, preferences pane |
| v2 | Attachment text extraction (PDF), URL content fetching for web-page items |
| v3+ | Batch inbox processing, proactive classification on item add, feedback loop from manual corrections |
