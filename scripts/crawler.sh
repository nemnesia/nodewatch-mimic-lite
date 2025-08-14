#!/bin/sh

cd "$(dirname "$0")"
cd ..
CRON_PATH="$(pwd)/src/oneshotCron.ts"
npx tsx "$CRON_PATH"
