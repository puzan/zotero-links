#!/usr/bin/env bash
set -e

PLUGIN_NAME="zotero-links"
VERSION="${1:-}"

if [ -n "$VERSION" ]; then
  OUTPUT="$(pwd)/${PLUGIN_NAME}-${VERSION}.xpi"
  TMPDIR=$(mktemp -d)
  trap 'rm -rf "$TMPDIR"' EXIT
  jq --arg v "$VERSION" '.version = $v' manifest.json > "$TMPDIR/manifest.json"
  cp bootstrap.js "$TMPDIR/bootstrap.js"
  (cd "$TMPDIR" && zip "$OUTPUT" manifest.json bootstrap.js)
else
  OUTPUT="${PLUGIN_NAME}.xpi"
  rm -f "$OUTPUT"
  zip "$OUTPUT" manifest.json bootstrap.js
fi

echo "Built: $OUTPUT"
