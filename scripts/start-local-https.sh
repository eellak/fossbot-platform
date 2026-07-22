#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/front-end/.local-certs"
LAN_IP="${FOSSBOT_LOCAL_IP:-$(hostname -I | awk '{print $1}')}"

if [[ -z "$LAN_IP" ]]; then
  echo "Could not detect a LAN IPv4 address. Set FOSSBOT_LOCAL_IP and try again." >&2
  exit 1
fi

mkdir -p "$CERT_DIR"

if [[ ! -f "$CERT_DIR/fossbot-local-ca.crt" || ! -f "$CERT_DIR/fossbot-local-ca.key" ]]; then
  openssl req -x509 -newkey rsa:3072 -nodes \
    -keyout "$CERT_DIR/fossbot-local-ca.key" \
    -out "$CERT_DIR/fossbot-local-ca.crt" \
    -sha256 -days 3650 \
    -subj "/CN=FOSSBot Local Development CA"
fi

openssl req -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -subj "/CN=$LAN_IP" \
  -addext "subjectAltName=IP:$LAN_IP,IP:127.0.0.1,DNS:localhost"

openssl x509 -req \
  -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/fossbot-local-ca.crt" \
  -CAkey "$CERT_DIR/fossbot-local-ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/server.crt" \
  -days 825 -sha256 \
  -copy_extensions copy

chmod 600 "$CERT_DIR"/*.key

(
  cd "$ROOT_DIR/front-end"
  npm run build
)

docker compose -f "$ROOT_DIR/docker-compose-local-https.yml" up -d

echo
echo "FOSSBot local HTTPS is available at: https://$LAN_IP:3443"
echo "Install this CA certificate as trusted on the test device:"
echo "$CERT_DIR/fossbot-local-ca.crt"
