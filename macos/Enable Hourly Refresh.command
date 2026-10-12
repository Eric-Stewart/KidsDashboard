#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
if [ "$(uname)" = "Darwin" ]; then
  node scripts/macos-schedule.mjs install
else
  node macos/linux-schedule.mjs install
fi
echo
read -r -p "Press Return to close."
