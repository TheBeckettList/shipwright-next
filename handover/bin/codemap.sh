#!/usr/bin/env bash
# Regenerates CODEBASE.md from the scripts' own header comments.
#   bash handover/bin/codemap.sh path/to/BP/scripts > handover/CODEBASE.md
exec python3 -I "$(cd "$(dirname "$0")" && pwd)/codemap.py" "${1:?path to BP/scripts}"
