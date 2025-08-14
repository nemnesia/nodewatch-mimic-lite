#! /bin/sh

cd "$(dirname "$0")"
cd ..
SERVER_PATH="$(pwd)/src/nodeWatchMimicLiteServer.ts"
pkill -f "$SERVER_PATH" || true
