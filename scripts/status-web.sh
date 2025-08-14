#!/bin/sh

cd "$(dirname "$0")"
cd ..
SERVER_PATH="$(pwd)/src/nodeWatchMimicLiteServer.ts"

if pgrep -f "$SERVER_PATH" > /dev/null; then
  echo "nodeWatchMimicLiteServer 稼働中: $SERVER_PATH"
  exit 0
else
  echo "nodeWatchMimicLiteServer 停止中: $SERVER_PATH"
  exit 1
fi
