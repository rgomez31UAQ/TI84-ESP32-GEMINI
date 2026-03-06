#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/rgomez31UAQ/TI84-ESP32-GEMINI.git"
REPO_URL="${1:-$REPO_URL_DEFAULT}"
TARGET_DIR="/opt/TI84-ESP32-GEMINI"
ENV_TARGET="/etc/ti84-backend.env"
SERVICE_TARGET="/etc/systemd/system/ti84-backend.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/pi/setup_pi_backend.sh"
  exit 1
fi

if ! id -u pi >/dev/null 2>&1; then
  echo "User 'pi' not found. Create it or adjust service User in scripts/pi/ti84-backend.service"
  exit 1
fi

echo "[1/8] Installing system dependencies"
apt-get update
apt-get install -y git curl ca-certificates build-essential

echo "[2/8] Installing Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || true)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/8] Cloning or updating repository"
if [[ -d "${TARGET_DIR}/.git" ]]; then
  git -C "${TARGET_DIR}" fetch --all --prune
  git -C "${TARGET_DIR}" reset --hard origin/main
else
  rm -rf "${TARGET_DIR}"
  git clone "${REPO_URL}" "${TARGET_DIR}"
fi

echo "[4/8] Installing server dependencies"
cd "${TARGET_DIR}/server"
npm ci --omit=dev

echo "[5/8] Installing environment file"
if [[ ! -f "${ENV_TARGET}" ]]; then
  cp .env.pi.example "${ENV_TARGET}"
  chown root:root "${ENV_TARGET}"
  chmod 600 "${ENV_TARGET}"
  echo "Created ${ENV_TARGET}. Edit it with your API keys before first use."
else
  echo "Keeping existing ${ENV_TARGET}"
fi

echo "[6/8] Installing systemd service"
cp "${TARGET_DIR}/scripts/pi/ti84-backend.service" "${SERVICE_TARGET}"
chmod 644 "${SERVICE_TARGET}"

systemctl daemon-reload

echo "[7/8] Enabling and starting service"
systemctl enable ti84-backend.service
systemctl restart ti84-backend.service

echo "[8/8] Status"
systemctl --no-pager --full status ti84-backend.service || true

echo "Done."
echo "Check health: curl -sS http://127.0.0.1:8080/healthz"
echo "Logs: journalctl -u ti84-backend.service -f"
