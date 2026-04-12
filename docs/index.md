# Zotero Links — Project Documentation

> Generated: 2026-04-12 | Scan: Deep | Type: Extension (Zotero Plugin)

## Contents

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | Plugin structure, lifecycle, components |
| [Project Context](./project-context.md) | LLM-optimized context for AI agents |

## Summary

**zotero-links** is a minimal Zotero 7/8 plugin that adds two context menu items:

- **Copy Collection Link** — copies `zotero://select/library/collections/KEY` (or `zotero://select/groups/ID/collections/KEY` for group libraries)
- **Copy Item Link** — copies `zotero://select/items/LIBRARYID_KEY`

## Repository Structure

```
zotero-links/
├── manifest.json          # Plugin metadata (Zotero manifest v2)
├── bootstrap.js           # All plugin logic (ZoteroLinks object)
├── build.sh               # XPI build script
├── .github/
│   └── workflows/
│       └── release.yml    # CI/CD: artifact builds and releases
├── docs/                  # Documentation (this directory)
└── CLAUDE.md              # Instructions for AI agents
```

## Technology Stack

| Category | Technology |
|---|---|
| Language | JavaScript (strict mode, ES2020+) |
| Platform | Zotero 7.0 – 8.* |
| Runtime | Gecko (Firefox 115-140) |
| UI | XUL (createXULElement) |
| Clipboard | XPCOM nsIClipboardHelper |
| CI/CD | GitHub Actions |
| Build | Bash + zip + jq |
| Package | XPI (zip archive) |

## Version History

| Tag | Notes |
|---|---|
| v0.1.0 | Initial release: Copy Collection Link |
| v0.1.1 | Patch |
| v0.2.0 | Added Copy Item Link |
