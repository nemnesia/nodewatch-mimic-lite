#! /bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
nohup npx tsx src/nodeWatchMimicLiteServer.ts >/dev/null 2>&1 &
