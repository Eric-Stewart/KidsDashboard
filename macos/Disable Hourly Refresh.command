#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
node scripts/macos-schedule.mjs remove
echo
read -r -p "Press Return to close."
