#!/bin/sh

cd "$(dirname "$0")"
cd ..
SERVER_PATH="$(pwd)/src/nodeWatchMimicLiteServer.ts"
nohup npx tsx "$SERVER_PATH" >/dev/null 2>&1 &
