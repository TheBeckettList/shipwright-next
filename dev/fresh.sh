#!/usr/bin/env bash
# Waterworld: start the dev server from a clean slate.
#   bash dev/fresh.sh          wipe the server and world, then start fresh
#   bash dev/fresh.sh --keep   restart without wiping the world
# On failure it writes dev/fresh-log.txt; paste that into chat.
set -uo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
LOG="$DEV/fresh-log.txt"
WORLD="$DEV/data/worlds/Waterworld Dev"
say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
fail() {
  {
    echo "== Waterworld fresh-start failure: $1"
    echo "== $(date)"
    echo "== macOS $(sw_vers -productVersion 2>/dev/null || echo '?'), chip $(uname -m)"
    echo "== $(docker --version 2>&1)"
    echo "== $(docker compose version 2>&1)"
    echo "== Network mode: $NETMODE"
    echo "== Container:"; docker ps -a --filter "name=$C" --format "{{.Status}}  {{.Image}}" 2>&1
    echo "== Last 150 log lines:"; docker logs --tail 150 "$C" 2>&1
  } > "$LOG"
  say "Failed: $1"
  echo "Details saved to dev/fresh-log.txt. Paste its contents into chat."
  exit 1
}

# 1. Docker is up
say "1/5 Checking Docker"
docker info >/dev/null 2>&1 || { echo "Docker isn't running. Open Docker Desktop, wait for 'Engine running', then rerun."; exit 1; }
docker compose version >/dev/null 2>&1 || fail "docker compose is missing; update Docker Desktop"
echo "OK"

# 2. Stop and clear the old server
say "2/5 Stopping any old server"
compose down --remove-orphans >/dev/null 2>&1
docker rm -f "$C" >/dev/null 2>&1
if [ "${1:-}" != "--keep" ]; then
  if ls "$DEV"/data/bedrock_server-* >/dev/null 2>&1; then
    # keep the server program itself (so a fresh start never has to download it again); clear the world and settings
    rm -rf "$DEV/data/worlds" "$DEV/data/server.properties" "$DEV/data/allowlist.json" "$DEV/data/permissions.json" "$DEV/data/valid_known_packs.json"
    export BDS_VERSION="${BDS_VERSION:-EXISTING}"
    echo "Old world and settings deleted (the server program is kept: no download needed)."
  else
    rm -rf "$DEV/data"
    echo "Old server files and world deleted."
  fi
else
  echo "Keeping the existing world."
fi
# a server zip downloaded by hand (from minecraft.net in a browser) and dropped in dev/: use it instead of downloading
zip=$(ls -t "$DEV"/bedrock-server-*.zip 2>/dev/null | head -1)
if [ -n "$zip" ] && ! ls "$DEV"/data/bedrock_server-* >/dev/null 2>&1; then
  mkdir -p "$DEV/data"
  unzip -oq "$zip" -d "$DEV/data" || fail "could not unzip $(basename "$zip")"
  # the image looks for its program as bedrock_server-<version>, as it names its own downloads
  v=$(basename "$zip" .zip | sed 's/^bedrock-server-//')
  [ -f "$DEV/data/bedrock_server" ] && mv -f "$DEV/data/bedrock_server" "$DEV/data/bedrock_server-$v"
  export BDS_VERSION=EXISTING
  echo "Using the server from $(basename "$zip") (no download)."
fi

# Files that older versions made and newer ones replaced (updates unzip over, never delete).
for stale in "RP/animations/boat.animation.json" "RP/render_controllers/boat.render_controllers.json"; do
  rm -f "$ROOT/$stale"
done

# 3. Tell the world which packs to load (macOS plutil reads JSON; no Python needed)
# the server program must be there before EXISTING is asked for: if the zip wasn't the Linux server, download instead
if [ "${BDS_VERSION:-}" = "EXISTING" ] && ! ls "$DEV"/data/bedrock_server-* >/dev/null 2>&1; then
  echo "No Linux server program in dev/data (a zip that wasn't the Ubuntu server?): downloading it instead."
  for z in "$DEV"/bedrock-server-*.zip; do [ -f "$z" ] && ! unzip -l "$z" 2>/dev/null | grep -q " bedrock_server$" && mv "$z" "$z.not-linux" && echo "  set aside $(basename "$z")"; done
  unset BDS_VERSION
fi

say "3/5 Linking Waterworld packs to the world"
mkdir -p "$WORLD"
read_field() { # file, key path
  plutil -extract "$2" raw -o - "$1" 2>/dev/null ||
  python3 -c "import json,sys;d=json.load(open(sys.argv[1]));[d:=d[k] for k in sys.argv[2].split('.')];print(d)" "$1" "$2" 2>/dev/null
}
read_version() { # file -> [a, b, c]
  v=$(plutil -extract header.version json -o - "$1" 2>/dev/null) ||
  v=$(python3 -c "import json,sys;print(json.dumps(json.load(open(sys.argv[1]))['header']['version']))" "$1" 2>/dev/null)
  echo "$v"
}
for pair in "BP:world_behavior_packs.json" "RP:world_resource_packs.json"; do
  pack="${pair%%:*}"; out="${pair##*:}"
  uuid=$(read_field "$ROOT/$pack/manifest.json" header.uuid)
  ver=$(read_version "$ROOT/$pack/manifest.json")
  [ -n "$uuid" ] && [ -n "$ver" ] || fail "could not read $pack/manifest.json"
  printf '[\n  { "pack_id": "%s", "version": %s }\n]\n' "$uuid" "$ver" > "$WORLD/$out"
  echo "$pack $uuid $ver"
done

# 4. Start
say "4/5 Downloading and starting the server (first run takes several minutes)"
compose pull || fail "could not download the server image (check your internet connection)"
compose up -d || fail "docker compose up failed"

# 5. Wait for 'Server started', fix required settings once, then report
wait_started() { # label
  local i state tries=0
  for i in $(seq 1 120); do
    if docker logs "$C" 2>&1 | grep -q "Server started"; then return 0; fi
    state=$(docker inspect -f '{{.State.Status}}' "$C" 2>/dev/null || echo missing)
    if [ "$state" = "exited" ] && docker logs "$C" 2>&1 | grep -q "failed to download" && [ "$tries" -lt 4 ]; then
      # minecraft.net sometimes drops the download part-way: wait and try again
      tries=$((tries + 1))
      echo; echo "The server download from minecraft.net was cut off. Trying again in $((tries * 20)) seconds ($tries of 4)..."
      sleep $((tries * 20))
      docker start "$C" >/dev/null 2>&1 || fail "could not restart the server after a failed download"
      continue
    fi
    if [ "$state" = "exited" ] || [ "$state" = "missing" ]; then
      docker logs "$C" 2>&1 | grep -q "failed to download" && fail "the server download from minecraft.net kept failing (their site, not Waterworld). Download the Ubuntu (Linux) server zip yourself from https://www.minecraft.net/en-us/download/server/bedrock in your browser, put it in the dev folder (it's named bedrock-server-<version>.zip), and run bash dev/fresh.sh again"
      fail "the server stopped during $1"
    fi
    printf "."
    sleep 5
  done
  docker logs "$C" 2>&1 | tail -3 | grep -q "Downloading Bedrock server" && fail "the server download from minecraft.net stalled (their site, not Waterworld). Download the Ubuntu (Linux) server zip yourself from https://www.minecraft.net/en-us/download/server/bedrock in your browser, put it in the dev folder (it's named bedrock-server-<version>.zip), and run bash dev/fresh.sh again"
  fail "the server didn't finish $1 within 10 minutes"
}

say "5/5 Waiting for the server"
wait_started "startup"
if ensure_props; then
  echo "Restarting to apply those settings..."
  docker restart "$C" >/dev/null || fail "restart after settings change failed"
  sleep 2
  # wait for a fresh 'Server started' after the restart
  for i in $(seq 1 120); do
    n=$(docker logs "$C" 2>&1 | grep -c "Server started")
    [ "$n" -ge 2 ] && break
    state=$(docker inspect -f '{{.State.Status}}' "$C" 2>/dev/null || echo missing)
    { [ "$state" = "exited" ] || [ "$state" = "missing" ]; } && fail "the server stopped after the settings change"
    printf "."; sleep 5
  done
fi

logs=$(docker logs "$C" 2>&1)
ver=$(echo "$logs" | grep -oE "Version:? *[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?" | tail -1)
transport=$(echo "$logs" | grep -oE '"transport":"[a-z]+"' | tail -1 | cut -d'"' -f4)
allow=$(echo "$logs" | grep -oE '"allow-list":"[a-z]+"' | tail -1 | cut -d'"' -f4)
ip=$(mac_ip)
say "Server is running. ${ver}"
echo "Network mode: $NETMODE   Mac IP: ${ip:-unknown}   Port: 19132"
echo "Transport: ${transport:-unknown}   Allow list: ${allow:-unknown}"
if echo "$logs" | grep -q "TRANSPORT TYPE ERROR"; then
  echo "Warning: the server reports a transport error. Players can't connect until it's fixed. Run: bash dev/dev.sh results"
fi
boot=$(echo "$logs" | grep -oE "\[Waterworld\] Scripts [0-9.]+ loaded" | tail -1)
if [ -n "$boot" ]; then echo "$boot"
else echo "Warning: Waterworld's scripts never reported in, so the pack didn't load. Run: bash dev/dev.sh results"; fi
if echo "$logs" | grep -qiE "Waterworld.*(error|fail)|pack.*(error|fail)"; then
  echo "Note: the log mentions a pack problem. Run: bash dev/dev.sh results"
fi
[ -z "${CONNECTING:-}" ] && echo && echo "To join from the Switch: bash dev/connect.sh"
exit 0
