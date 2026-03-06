#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/pi/configure_pi_wifi.sh ..."
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage:
  sudo bash scripts/pi/configure_pi_wifi.sh add "SSID" "PASSWORD" [PRIORITY]
  sudo bash scripts/pi/configure_pi_wifi.sh list
  sudo bash scripts/pi/configure_pi_wifi.sh status

Examples:
  sudo bash scripts/pi/configure_pi_wifi.sh add "MiModem" "clave123" 90
  sudo bash scripts/pi/configure_pi_wifi.sh add "MiHotspot" "clave456" 70

Notes:
  - Higher PRIORITY wins when both networks are visible.
  - Works with NetworkManager (nmcli) if available.
  - Falls back to wpa_supplicant on minimal Raspberry Pi OS.
USAGE
}

has_nmcli() {
  command -v nmcli >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager
}

add_nmcli() {
  local ssid="$1"
  local pass="$2"
  local priority="$3"
  local con_name="ti84-${ssid}"

  if nmcli -t -f NAME connection show | grep -Fxq "$con_name"; then
    nmcli connection modify "$con_name" \
      802-11-wireless.ssid "$ssid" \
      802-11-wireless-security.key-mgmt wpa-psk \
      802-11-wireless-security.psk "$pass" \
      connection.autoconnect yes \
      connection.autoconnect-priority "$priority"
  else
    nmcli connection add type wifi ifname wlan0 con-name "$con_name" ssid "$ssid" \
      wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$pass" \
      connection.autoconnect yes connection.autoconnect-priority "$priority"
  fi

  nmcli device set wlan0 autoconnect yes || true
  nmcli connection up "$con_name" || true
}

list_nmcli() {
  nmcli -t -f NAME,TYPE,AUTOCONNECT,AUTOCONNECT-PRIORITY connection show | grep ":wifi:" || true
}

status_nmcli() {
  nmcli -t -f DEVICE,TYPE,STATE,CONNECTION dev status
  nmcli -t -f ACTIVE,SSID,SIGNAL,SECURITY dev wifi list ifname wlan0 | head -n 12 || true
}

add_wpa() {
  local ssid="$1"
  local pass="$2"
  local priority="$3"
  local conf="/etc/wpa_supplicant/wpa_supplicant.conf"
  local tmp
  tmp="$(mktemp)"

  # Remove old network block for same SSID to avoid duplicates.
  awk -v target="$ssid" '
    BEGIN { skip=0; block="" }
    {
      if ($0 ~ /^network=\{/) {
        skip=0
        block=$0"\n"
        inblock=1
        next
      }
      if (inblock) {
        block=block$0"\n"
        if ($0 ~ /ssid="[^"]+"/) {
          s=$0
          sub(/.*ssid="/, "", s)
          sub(/".*/, "", s)
          if (s == target) skip=1
        }
        if ($0 ~ /^\}/) {
          if (!skip) printf "%s", block
          inblock=0
          block=""
          skip=0
        }
        next
      }
      print
    }
  ' "$conf" > "$tmp"

  mv "$tmp" "$conf"
  chmod 600 "$conf"

  {
    echo
    echo "network={"
    echo "    ssid=\"$ssid\""
    echo "    psk=\"$pass\""
    echo "    priority=$priority"
    echo "}"
  } >> "$conf"

  if command -v wpa_cli >/dev/null 2>&1; then
    wpa_cli -i wlan0 reconfigure || true
  fi
  systemctl restart wpa_supplicant || true
  systemctl restart dhcpcd || true
}

list_wpa() {
  grep -E "ssid=|priority=" /etc/wpa_supplicant/wpa_supplicant.conf || true
}

status_wpa() {
  ip -br addr show wlan0 || true
  iwgetid -r || true
  ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 && echo "Internet: OK" || echo "Internet: FAIL"
}

action="${1:-}"

case "$action" in
  add)
    ssid="${2:-}"
    pass="${3:-}"
    priority="${4:-80}"

    if [[ -z "$ssid" || -z "$pass" ]]; then
      usage
      exit 1
    fi

    if has_nmcli; then
      add_nmcli "$ssid" "$pass" "$priority"
    else
      add_wpa "$ssid" "$pass" "$priority"
    fi
    echo "Saved WiFi profile: SSID=$ssid priority=$priority"
    ;;
  list)
    if has_nmcli; then
      list_nmcli
    else
      list_wpa
    fi
    ;;
  status)
    if has_nmcli; then
      status_nmcli
    else
      status_wpa
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac
