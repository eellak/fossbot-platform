#!/usr/bin/env bash
set -euo pipefail

STATE_DIR=/var/lib/fossbot
MARKER="$STATE_DIR/hostname-initialized"

if [[ -e "$MARKER" ]]; then
  exit 0
fi

adjectives=(
  amber brave bright calm clever coral cosmic eager gentle golden
  happy jolly kind lively lucky merry nimble proud quiet rapid
  silver smart sunny swift tiny vivid warm wise zesty
)
nouns=(
  badger bear bee comet dolphin eagle falcon fox gecko heron
  koala lion lynx otter owl panda penguin raven robin seal
  sparrow tiger turtle whale wolf
)

read -r random_value < <(od -An -N4 -tu4 /dev/urandom)
adjective=${adjectives[random_value % ${#adjectives[@]}]}
noun=${nouns[(random_value / ${#adjectives[@]}) % ${#nouns[@]}]}
suffix=$(printf '%03d' "$((random_value % 1000))")
new_hostname="fossbot-${adjective}-${noun}-${suffix}"

install -d -m 0755 "$STATE_DIR"
printf '%s\n' "$new_hostname" > /etc/hostname

hosts_tmp=$(mktemp)
trap 'rm -f "$hosts_tmp"' EXIT
awk -v hostname="$new_hostname" '
  $1 == "127.0.1.1" {
    if (!replaced) {
      print "127.0.1.1\t" hostname
      replaced = 1
    }
    next
  }
  { print }
  END {
    if (!replaced) {
      print "127.0.1.1\t" hostname
    }
  }
' /etc/hosts > "$hosts_tmp"
install -m 0644 "$hosts_tmp" /etc/hosts

hostname "$new_hostname"
printf '%s\n' "$new_hostname" > "$MARKER"
chmod 0644 "$MARKER"
logger -t fossbot-hostname "Assigned permanent first-boot hostname: $new_hostname"

