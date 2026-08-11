#!/usr/bin/env bash
set -euo pipefail
DEST="${1:-src/assets}"
VERSION="${2:-0.16.0}"
node "$(dirname "$0")/collect-clash-assets.mjs" --dest "$DEST" --version "$VERSION"
