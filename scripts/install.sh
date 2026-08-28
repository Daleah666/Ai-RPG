#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -d "$HOME/Google Drive" ]]; then
  export VEIL_DRIVE_FOLDER="$HOME/Google Drive/VeilStudio"
else
  export VEIL_DRIVE_FOLDER="$HOME/VeilStudio"
fi
npm install
npm run build
mkdir -p "$VEIL_DRIVE_FOLDER"/{inbox/processed,outbox,library,app}
cp scripts/Launch-VeilStudio.sh "$VEIL_DRIVE_FOLDER/app/"
chmod +x "$VEIL_DRIVE_FOLDER/app/Launch-VeilStudio.sh" scripts/Launch-VeilStudio.sh
if [[ -d dist ]]; then
  find dist -name 'Veil Studio*' -o -name 'veil-studio*.AppImage' | head -1 | while read -r f; do
    cp "$f" "$VEIL_DRIVE_FOLDER/app/" || true
  done
fi
echo "Installed. Launch: npm run launch"
echo "Drive / AI folder: $VEIL_DRIVE_FOLDER"
echo "Drop request JSON in $VEIL_DRIVE_FOLDER/inbox"
