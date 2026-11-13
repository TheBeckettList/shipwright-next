# Shared helpers for the Waterworld dev scripts. Sourced, not run.
DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DEV")"
C=waterworld-dev

# Network mode: DEV_NET env wins, then dev/.netmode (written by connect.sh), else host.
NETMODE="${DEV_NET:-$(cat "$DEV/.netmode" 2>/dev/null || echo host)}"
if [ "$NETMODE" = "ports" ]; then FILE="$DEV/docker-compose.ports.yml"; else FILE="$DEV/docker-compose.yml"; fi
compose() { docker compose -f "$FILE" "$@"; }

mac_ip() {
  local ip=""
  for n in en0 en1 en2 en3; do ip=$(ipconfig getifaddr "$n" 2>/dev/null) && [ -n "$ip" ] && { echo "$ip"; return; }; done
  echo ""
}

# Sends a real Bedrock "unconnected ping" and prints the server's reply line.
# Exit 0 = the server answered at that address.
bedrock_ping() { # host [port]
  perl -MIO::Socket::INET -e '
    my ($h, $p) = @ARGV;
    my $s = IO::Socket::INET->new(Proto => "udp", PeerAddr => $h, PeerPort => $p) or exit 2;
    my $magic = pack("H*", "00ffff00fefefefefdfdfdfd12345678");
    $s->send(pack("C", 1) . pack("Q>", time) . $magic . pack("Q>", 4242));
    my $rin = ""; vec($rin, fileno($s), 1) = 1;
    exit 1 unless select($rin, undef, undef, 3);
    my $r; $s->recv($r, 4096);
    exit 1 unless defined $r && length($r) > 35 && ord($r) == 0x1c;
    print substr($r, 35), "\n"; exit 0;
  ' "$1" "${2:-19132}" 2>/dev/null
}

firewall_on() {
  /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -qi "enabled"
}

# Server settings the dev setup needs. Docker env vars set most of them, but
# newer properties may not be mapped, so these are enforced in server.properties.
REQUIRED_PROPS="allow-list=false transport=nethernet content-log-console-output-enabled=true"

# Fixes server.properties in place. Prints what changed; returns 0 if anything changed.
ensure_props() {
  local file="$DEV/data/server.properties" changed=1 kv key want have
  [ -f "$file" ] || return 1
  for kv in $REQUIRED_PROPS; do
    key="${kv%%=*}"; want="${kv#*=}"
    have=$(grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-)
    if [ "$have" != "$want" ]; then
      if grep -qE "^${key}=" "$file"; then
        perl -pi -e "s/^\Q${key}\E=.*/${key}=${want}/" "$file"
      else
        printf '\n%s=%s\n' "$key" "$want" >> "$file"
      fi
      echo "  Set ${key}=${want} (was ${have:-unset})"
      changed=0
    fi
  done
  return $changed
}

# Checks whether a DNS server redirects a featured-server hostname (BedrockConnect style).
check_bc_dns() { # dns_ip
  local host=geo.hivebedrock.network normal via
  normal=$(dig +short "$host" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
  via=$(dig +short @"$1" "$host" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
  echo "Normal DNS:      $host -> ${normal:-no answer}"
  echo "Through $1: $host -> ${via:-no answer}"
  if [ -z "$via" ]; then echo "Result: that DNS server didn't answer. Wrong address, or it's down."
  elif [ "$via" = "$normal" ]; then echo "Result: no redirect. That DNS isn't sending featured servers to BedrockConnect."
  else echo "Result: redirect works. If the Switch still loads the real server, it isn't using this DNS."
  fi
}

server_transport() {
  grep -E "^transport=" "$DEV/data/server.properties" 2>/dev/null | cut -d= -f2
}

# NetherNet's handshake is HTTP over TCP on the server port. Any HTTP reply,
# even an error code, proves a client can reach it. Prints the code.
nethernet_check() { # host [port]
  local code
  code=$(curl -s -o /dev/null -m 4 -w "%{http_code}" "http://$1:${2:-19132}/" 2>/dev/null)
  [ -n "$code" ] && [ "$code" != "000" ] && { echo "$code"; return 0; }
  return 1
}
