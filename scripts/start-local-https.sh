#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_HOST="${FOSSBOT_LOCAL_HOST:-${FOSSBOT_LOCAL_IP:-$(hostname -I | awk '{print $1}')}}"

if [[ -z "$LOCAL_HOST" ]]; then
  echo "Could not detect a LAN IPv4 address. Set FOSSBOT_LOCAL_HOST and try again." >&2
  exit 1
fi

(
  cd "$ROOT_DIR/front-end"
  npm run build
)

export FOSSBOT_LOCAL_HOST="$LOCAL_HOST"
# This standalone helper connects to the backend published on the Docker host.
export FOSSBOT_LOCAL_API_UPSTREAM="${FOSSBOT_LOCAL_API_UPSTREAM:-host.docker.internal:8000}"
compose=(docker compose -f "$ROOT_DIR/docker-compose-local-https.yml")
"${compose[@]}" up -d --wait local-https

# Export only the public CA. Its private key stays in the Caddy volume.
ca_dir="$(mktemp -d)"
"${compose[@]}" cp local-https:/data/caddy/pki/authorities/local/root.crt "$ca_dir/fossbot-local-ca.crt"

echo "FOSSBot local HTTPS is available at https://$LOCAL_HOST:3443"
echo "Install $ca_dir/fossbot-local-ca.crt as a trusted CA on the test device."
