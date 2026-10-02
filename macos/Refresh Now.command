#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null; then
  echo "Install Node.js 24 and run Setup.command first."
else
  node --import tsx collector/run.ts
  result=$?
  if [ "$result" -eq 0 ]; then
    echo "Refresh finished. Open the website and select Reload dashboard."
  else
    echo "Refresh needs attention. Review the message above; saved data is preserved."
  fi
fi
echo
read -r -p "Press Return to close."
