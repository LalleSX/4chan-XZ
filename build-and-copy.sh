#!/usr/bin/env bash
set -euo pipefail

# Navigate to the script's directory
cd "$(dirname "$(readlink -f "$0")")"

# Build the project
npm run build

# Path to the built userscript
USERSCRIPT_PATH="dist/4chan-XZ.user.js"

if [ ! -f "$USERSCRIPT_PATH" ]; then
  echo "Error: Userscript not found at $USERSCRIPT_PATH" >&2
  exit 1
fi

# Copy the file contents to the Windows clipboard via clip.exe
cat "$USERSCRIPT_PATH" | clip.exe

echo "Built project and copied dist/4chan-XZ.user.js to the clipboard."
