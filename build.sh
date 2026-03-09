#!/usr/bin/env bash
set -e

PLUGIN_NAME="zotero-links"
OUTPUT="${PLUGIN_NAME}.xpi"

rm -f "$OUTPUT"
zip -r "$OUTPUT" manifest.json bootstrap.js

echo "Built: $OUTPUT"
