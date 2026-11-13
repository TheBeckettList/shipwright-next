#!/usr/bin/env bash
# Waterworld: set up the server for joining from a Switch, check it, and print the steps.
#   bash dev/connect.sh
set -uo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
say() { printf "\n\033[1m%s\033[0m\n" "$*"; }

# 1. Published-port mode, remembered for every dev command from now on
say "1/4 Switching to the published-port setup (keeps your world)"
echo "ports" > "$DEV/.netmode"
export DEV_NET=ports CONNECTING=1
bash "$DEV/fresh.sh" --keep || exit 1

# 2. Does the server answer?
say "2/4 Testing the connection"
ip=$(mac_ip)
[ -n "$ip" ] || { echo "Couldn't find your Mac's IP. Is Wi-Fi connected?"; exit 1; }
ok_local=1; ok_lan=1
for i in 1 2 3 4 5 6; do
  if [ "$(server_transport)" = "nethernet" ]; then
    nethernet_check 127.0.0.1 >/dev/null && ok_local=0
    nethernet_check "$ip" >/dev/null && ok_lan=0
  else
    bedrock_ping 127.0.0.1 >/dev/null && ok_local=0
    bedrock_ping "$ip" >/dev/null && ok_lan=0
  fi
  [ $ok_local -eq 0 ] && [ $ok_lan -eq 0 ] && break
  sleep 5
done
echo "Transport: $(server_transport || echo unknown)"
[ $ok_local -eq 0 ] && echo "On this Mac: server answers." || echo "On this Mac: no answer."
[ $ok_lan -eq 0 ] && echo "On your network ($ip): server answers." || echo "On your network ($ip): no answer (check the firewall below)."

# 3. Firewall
say "3/4 Checking the macOS firewall"
if firewall_on; then
  echo "The firewall is on. If the Switch can't connect, open System Settings > Network > Firewall > Options"
  echo "and set Docker to 'Allow incoming connections' (or turn the firewall off while testing)."
else
  echo "The firewall is off. Nothing to change."
fi
if [ $ok_local -ne 0 ]; then
  echo
  echo "The server isn't answering yet. Run 'bash dev/dev.sh logs' and paste everything from 'Contents of server.properties' down into chat."
  exit 1
fi

# 4. BedrockConnect address and Switch steps
say "4/4 Switch steps"
dns=""
for branch in master main; do
  dns=$(curl -fsSL --max-time 8 "https://raw.githubusercontent.com/Pugmatt/BedrockConnect/$branch/README.md" 2>/dev/null \
        | grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' | grep -vE '^(127|192\.168|10|0)\.' | awk '!seen[$0]++' | head -3 | tr '\n' ' ')
  [ -n "$dns" ] && break
done

cat <<STEPS

  On the Switch:
  1. System Settings > Internet > Internet Settings > your Wi-Fi > Change Settings
  2. DNS Settings: Manual
STEPS
if [ -n "$dns" ]; then
  echo "     Primary DNS: the first address listed in BedrockConnect's README right now: $dns"
  echo "     (Double-check at github.com/Pugmatt/BedrockConnect if it doesn't work.)"
else
  echo "     Primary DNS: the address listed at github.com/Pugmatt/BedrockConnect"
fi
cat <<STEPS
     Secondary DNS: 8.8.8.8 (as BedrockConnect recommends). Then Save.
  3. Open Minecraft (signed in to your Microsoft account; needs Nintendo Switch Online)
  4. Servers tab > join Mineville, Lifeboat, Enchanted, Galaxite or The Hive (only these redirect)
  5. Connect to a Server:  Address $ip   Port 19132
  6. Once you've spawned, come back here and run:  bash dev/dev.sh test

  Afterward, set the Switch's DNS back to Automatic to use featured servers normally.

STEPS
