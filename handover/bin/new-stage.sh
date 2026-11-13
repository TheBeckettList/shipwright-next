#!/usr/bin/env bash
# Starts your stage: creates handover/stages/S<next>-<date>-<code>.md from the template and, in the git repo with
# a clean working tree, a branch stage/S<next>-<code> to work on.
#   bash handover/bin/new-stage.sh <your code> "<short title>"
set -euo pipefail
H="$(cd "$(dirname "$0")/.." && pwd)"
WHO="${1:?your roster code, e.g. A}"; TITLE="${2:?a short title in quotes}"
last=$(ls "$H/stages" 2>/dev/null | sed -nE 's/^S([0-9]{3}).*/\1/p' | sort -n | tail -1)
n=$(printf "%03d" $(( 10#${last:-0} + 1 )))
d=$(date +%Y-%m-%d)
from=$(grep -m1 -oE 'tag `v[0-9.]+`' "$H/STATE.md" | grep -oE '[0-9.]+[0-9]' || true)
out="$H/stages/S$n-$d-$WHO.md"
[ -e "$out" ] && { echo "Already exists: $out"; exit 1; }
if git -C "$H" rev-parse --git-dir >/dev/null 2>&1; then
  if [ -z "$(git -C "$H" status --porcelain)" ]; then
    git -C "$H" switch -c "stage/S$n-$WHO" && echo "On branch stage/S$n-$WHO"
  else
    echo "Note: uncommitted changes, so no branch was made. Commit or stash, then: git switch -c stage/S$n-$WHO"
  fi
fi
sed -e "s/{{ID}}/S$n/" -e "s/{{TITLE}}/$TITLE/" -e "s/{{WHO}}/$WHO/" -e "s/{{DATE}}/$d/" -e "s/{{FROM}}/${from:-see STATE.md}/" \
  "$H/templates/STAGE_TEMPLATE.md" > "$out"
echo "Created $out"
echo "Now: set 'Baton:' in STATE.md to $WHO, then fill in section 1."
