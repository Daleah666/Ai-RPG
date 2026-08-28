#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [[ -z "${VEIL_DRIVE_FOLDER:-}" ]]; then
  if [[ -d "$HOME/Google Drive" ]]; then
    export VEIL_DRIVE_FOLDER="$HOME/Google Drive/VeilStudio"
  else
    export VEIL_DRIVE_FOLDER="$HOME/VeilStudio"
  fi
fi
if [[ ! -d node_modules ]]; then
  npm install
fi
if [[ ! -d .next ]]; then
  npm run build
fi
echo "Launching Veil Studio"
echo "Drive folder: $VEIL_DRIVE_FOLDER"
echo "Drop JSON requests in $VEIL_DRIVE_FOLDER/inbox"
exec node scripts/launch.mjs
