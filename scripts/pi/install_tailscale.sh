#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/pi/install_tailscale.sh"
  exit 1
fi

curl -fsSL https://tailscale.com/install.sh | sh

echo "Run: sudo tailscale up"
echo "Then use your phone Tailscale app to SSH to the Pi private tailnet IP."
