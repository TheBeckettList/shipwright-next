#!/usr/bin/env bash
# Waterworld dev loop. Run from the dev/ folder.
#   Network mode comes from dev/.netmode (connect.sh sets it to "ports").
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
# Sends a console command to the server. The image's send-command finds the
# server by process name, which fails when it runs through Rosetta on Apple
# Silicon, so fall back to locating the process by its full command line.
cmd() {
  docker exec "$C" send-command "$@" 2>/dev/null && return 0
  docker exec "$C" bash -c '
    for d in /proc/[0-9]*; do   # the image has no pgrep: read each process command line instead
      pid=${d#/proc/}; grep -qa "bedrock_server" "$d/cmdline" 2>/dev/null || continue
      if [ -w "$d/fd/0" ]; then echo "$*" > "$d/fd/0" && exit 0; fi
    done
    echo "Could not reach the server console. Type the command in game chat instead: /$*"; exit 1
  ' _ "$@"
}

case "${1:-help}" in
  fresh)    exec bash ./fresh.sh ;;          # wipe server and world, start clean
  up)       exec bash ./fresh.sh --keep ;;   # start, keeping the world
  down)     compose down ;;
  logs)     compose logs -f --tail 50 ;;
  status)
    docker ps --filter "name=$C" --format "Container: {{.Status}}" | grep . || echo "Container: not running"
    echo "Network mode: $NETMODE   Transport: $(server_transport || echo unknown)"
    ip=$(mac_ip)
    if [ "$(server_transport)" = "nethernet" ]; then
      if code=$(nethernet_check 127.0.0.1); then echo "On this Mac: NetherNet handshake port answers (HTTP $code)"; else echo "On this Mac: NetherNet handshake port (TCP 19132) not reachable"; fi
      if [ -n "$ip" ]; then
        if code=$(nethernet_check "$ip"); then echo "On your network ($ip): handshake port answers (HTTP $code)"; else echo "On your network ($ip): handshake port not reachable"; fi
      fi
    else
      if reply=$(bedrock_ping 127.0.0.1); then echo "On this Mac: server answers ($reply)"; else echo "On this Mac: no answer"; fi
      if [ -n "$ip" ]; then
        if bedrock_ping "$ip" >/dev/null; then echo "On your network ($ip): server answers"; else echo "On your network ($ip): no answer"; fi
      fi
    fi
    want=$(plutil -extract header.version json -o - ../RP/manifest.json 2>/dev/null | tr -d ' ')
    have=$(grep -oE '"version": *\[[0-9, ]+\]' "data/worlds/Waterworld Dev/world_resource_packs.json" 2>/dev/null | grep -oE '\[.*\]' | tr -d ' ')
    if [ -n "$want" ] && [ "$want" != "$have" ]; then echo "Pack versions: MISMATCH (pack $want, world asks for ${have:-none}). Run: bash dev/dev.sh up"; else echo "Pack versions: OK ($want)"; fi
    firewall_on && echo "macOS firewall: on (allow Docker if the Switch can't connect)" || echo "macOS firewall: off"
    ;;
  ip)       mac_ip ;;
  connect)  exec bash ./connect.sh ;;
  update|refresh) exec bash ./refresh.sh "${@:2}" ;;   # install the newest update zip from Downloads (--wipe: clean world)
  version)  cmd scriptevent waterworld:version && sleep 1 && docker logs "$C" 2>&1 | grep -oE "Waterworld\] Scripts [0-9.]+ loaded" | tail -1 ;;
  dnscheck) check_bc_dns "${2:?usage: bash dev/dev.sh dnscheck <dns-address>}" ;;
  cmd)      shift; cmd "$@" ;;                               # a server console command
  reload)   cmd reload && echo "Scripts reloaded." ;;              # after editing BP/scripts
  restart)  compose restart && echo "Restarted." ;;                # after editing BP json (entities, blocks)
  rp)       python3 ../tools/bump_version.py && bash ./fresh.sh --keep \
              && echo "Resource pack version bumped; rejoin to download it." ;;  # after editing RP
  stats)    cmd scriptevent waterworld:version && sleep 1 && docker logs "$C" 2>&1 | grep -oE "Waterworld\] Scripts .*" | tail -1 ;;   # chunks laid and how fast
  report)
    out="$HOME/Desktop/waterworld-report.txt"
    {
      echo "== Waterworld report $(date)"
      bash "$0" status
      echo; echo "== Boats near you"
      cmd scriptevent waterworld:inspect >/dev/null 2>&1; sleep 2
      compose logs --no-color --tail 80 | grep -A3 "Waterworld inspect" | sed 's/^.*\] \[Scripting\] //'
      echo; echo "== Errors, warnings and Waterworld messages (last 30 minutes)"
      docker logs --since 30m "$C" 2>&1 | grep -E "ERROR|WARN|Waterworld|Player (connected|disconnected)" | grep -v "server.properties" | tail -80
    } > "$out" 2>&1
    echo "Saved to $out. Open it, copy everything, and paste it into chat."
    ;;
  results)  compose logs --no-color --tail 400 | grep -E "Waterworld test|Waterworld\]|\[Scripting\]|error|Error" | tail -60 ;;
  *) echo "Usage: bash dev.sh fresh|up|down|connect|update|refresh|version|logs|status|ip|reload|restart|rp|stats|report|results" ;;
esac
