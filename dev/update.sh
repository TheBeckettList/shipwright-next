#!/usr/bin/env bash
# Kept for old habits: "bash dev/dev.sh update" now does a full refresh (dev/refresh.sh).
#   bash dev/update.sh [--wipe] [path/to/zip]
exec bash "$(cd "$(dirname "$0")" && pwd)/refresh.sh" "$@"
