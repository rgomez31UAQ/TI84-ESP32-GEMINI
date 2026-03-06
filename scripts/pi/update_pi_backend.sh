#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="/opt/TI84-ESP32-GEMINI"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/pi/update_pi_backend.sh"
  exit 1
fi

if [[ ! -d "${TARGET_DIR}/.git" ]]; then
  echo "${TARGET_DIR} not found. Run setup first."
  exit 1
fi

git -C "${TARGET_DIR}" fetch --all --prune
git -C "${TARGET_DIR}" reset --hard origin/main

cd "${TARGET_DIR}/server"
npm ci --omit=dev

systemctl restart ti84-backend.service
systemctl --no-pager --full status ti84-backend.service || true

curl -sS http://127.0.0.1:8080/healthz || true
