#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.."
trap 'echo; read -r -p "Press Return to close."' EXIT
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node.js 24 LTS and Google Chrome, then run Setup again."
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<24){console.error("Node.js 24 or newer is required.");process.exit(1)}'
npm ci
node scripts/setup-collector.mjs
node --input-type=module -e 'import{existsSync,writeFileSync,chmodSync}from"node:fs";if(!existsSync(".env.local"))writeFileSync(".env.local","CLASSROOM_SOURCE=browser\nKIDS_DASHBOARD_INGEST_KEY=\n",{mode:0o600});chmodSync(".env.local",0o600)'
chmod +x macos/*.command
echo "Setup complete. Fill in .config and the ingestion key in .env.local."
echo "Then double-click Refresh Now.command. No local database is needed."
