#!/usr/bin/env bash
# Full refresh: replaces the Waterworld packs completely with the newest update zip, restarts the
# server, and checks the server is really running that version.
#   bash dev/refresh.sh               newest waterworld-update*.zip in ~/Downloads, world kept
#   bash dev/refresh.sh --wipe        also delete the world (old boats, docks and test sites)
#   bash dev/refresh.sh path/to.zip   a specific zip (combine with --wipe if you like)
# On failure it says what went wrong; paste the output into chat.
set -uo pipefail

# Everything runs from this function, which bash reads whole before starting: the script
# replaces itself partway through.
main() {
  local DEV ROOT WIPE="" ZARG="" Z NEW OLD
  TMP=""
  DEV="$(cd "$(dirname "$0")" && pwd)"
  ROOT="$(dirname "$DEV")"
  for a in "$@"; do
    case "$a" in
      --wipe) WIPE=1 ;;
      *) ZARG="$a" ;;
    esac
  done
  say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
  ver() { python3 -c "import json,sys;print('.'.join(map(str,json.load(open(sys.argv[1]))['header']['version'])))" "$1" 2>/dev/null ||
          plutil -extract header.version json -o - "$1" 2>/dev/null | tr -d '[] \n' | tr ',' '.'; }

  say "1/5 Finding the update"
  Z="${ZARG:-$(ls -t "$HOME"/Downloads/waterworld-update*.zip 2>/dev/null | head -1)}"
  if [ -z "$Z" ] || [ ! -f "$Z" ]; then echo "No waterworld-update zip in Downloads. Download it from the chat first."; exit 1; fi
  echo "Using: $Z ($(date -r "$Z" '+%b %d %H:%M' 2>/dev/null || echo '?'))"
  TMP="$(mktemp -d)"
  trap '[ -n "${TMP:-}" ] && rm -rf "$TMP"' EXIT
  unzip -oq "$Z" -d "$TMP" || { echo "Couldn't unzip it. Download it again."; exit 1; }
  if [ ! -f "$TMP/BP/manifest.json" ] || [ ! -f "$TMP/RP/manifest.json" ]; then
    echo "That zip has no BP/ and RP/ at the top: it isn't a Waterworld update zip."; exit 1
  fi
  NEW="$(ver "$TMP/BP/manifest.json")"
  OLD="$(ver "$ROOT/BP/manifest.json" 2>/dev/null || echo none)"
  echo "Installed now: ${OLD:-none}   In the zip: $NEW"
  [ -f "$TMP/VERSION" ] || echo "Note: this zip is from before the refresh script existed; it still works."
  if [ "$NEW" = "$OLD" ]; then echo "Same version: reinstalling it cleanly anyway."; fi

  say "2/5 Stopping the server"
  # shellcheck source=/dev/null
  source "$DEV/lib.sh"
  compose down --remove-orphans >/dev/null 2>&1
  docker rm -f "$C" >/dev/null 2>&1
  echo "Stopped."

  say "3/5 Replacing the packs (nothing old is kept)"
  rm -rf "$ROOT/BP" "$ROOT/RP"
  cp -R "$TMP/BP" "$ROOT/BP" && cp -R "$TMP/RP" "$ROOT/RP" || { echo "Copying the packs failed."; exit 1; }
  for d in dev tools tests; do
    [ -d "$TMP/$d" ] && mkdir -p "$ROOT/$d" && cp -R "$TMP/$d/." "$ROOT/$d/"
  done
  for f in README.md package.json; do [ -f "$TMP/$f" ] && cp "$TMP/$f" "$ROOT/$f"; done
  echo "Behavior pack $(ver "$ROOT/BP/manifest.json"), resource pack $(ver "$ROOT/RP/manifest.json")"

  say "4/5 Starting the server${WIPE:+ on a fresh world}"
  if [ -n "$WIPE" ]; then bash "$DEV/fresh.sh" || exit 1; else bash "$DEV/fresh.sh" --keep || exit 1; fi

  say "5/5 Checking what the server loaded"
  local line="" i
  for i in $(seq 1 12); do
    line=$(docker logs "$C" 2>&1 | grep -oE "Waterworld\] Scripts [0-9.]+ loaded" | tail -1)
    [ -n "$line" ] && break
    sleep 5
  done
  if [ -z "$line" ]; then
    echo "The server never reported loading Waterworld's scripts. Its pack and script errors:"
    docker logs "$C" 2>&1 | grep -iE "pack|script|error" | grep -v "server.properties" | tail -25
    echo "Paste this into chat."
    exit 1
  fi
  local running
  running=$(echo "$line" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
  if [ "$running" = "$NEW" ]; then
    echo "OK: the server is running Waterworld $running."
    echo "Rejoin from the Switch; it downloads the new resource pack. In game, /scriptevent waterworld:version confirms it."
  else
    echo "MISMATCH: the zip is $NEW but the server is running $running. Paste this output into chat."
    exit 1
  fi
}

main "$@"
exit
