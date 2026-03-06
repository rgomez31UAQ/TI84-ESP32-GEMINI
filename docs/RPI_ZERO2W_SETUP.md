# Raspberry Pi Zero 2 W Setup (No Credit Card Cloud)

This guide runs the TI84 backend on a local Raspberry Pi Zero 2 W and controls it from your phone.

## Recommended OS

- Raspberry Pi OS Lite 64-bit (Bookworm)

Why:

- Lightweight and stable
- Works well with Node.js and systemd services
- Easy SSH management from phone

## 1. Flash and First Boot

1. Use Raspberry Pi Imager.
1. Select `Raspberry Pi OS Lite (64-bit)`.
1. In advanced options:

- Enable SSH
- Set hostname (example: `ti84pi`)
- Configure WiFi SSID/password
- Set username/password

1. Boot the Pi and connect it to power.

## 2. SSH from Phone

1. Android: Termius / JuiceSSH / ConnectBot.
1. iOS: Termius / Blink Shell.
1. Connect with:

```bash
ssh pi@ti84pi.local
```

If mDNS fails, use router IP (example `ssh pi@192.168.1.50`).

## 3. Install Backend as a Service

On the Pi, run:

```bash
git clone https://github.com/rgomez31UAQ/TI84-ESP32-GEMINI.git
cd TI84-ESP32-GEMINI
sudo bash scripts/pi/setup_pi_backend.sh
```

This will:

- Install Node.js 20
- Install and enable mDNS (`avahi-daemon`) for `ti84pi.local`
- Deploy code to `/opt/TI84-ESP32-GEMINI`
- Install systemd service `ti84-backend.service`
- Create `/etc/ti84-backend.env`

## 4. Add API Keys

Edit env file:

```bash
sudo nano /etc/ti84-backend.env
```

Set at least one provider key:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_API_KEY`

Recommended order:

```env
AI_PROVIDER_ORDER=groq,openrouter,gemini
```

Restart service:

```bash
sudo systemctl restart ti84-backend.service
```

## 5. Verify Health

```bash
curl -sS http://127.0.0.1:8080/healthz
```

Expected:

```json
{"ok":true,"service":"ti84-esp32-gemini-server"}
```

## 6. Use with ESP32

In ESP32 captive portal (`calc` AP):

- Set WiFi credentials
- Set Backend URL to Pi URL (recommended):
- `http://ti84pi.local:8080`

Using `ti84pi.local` avoids changing the URL when IP changes between modem/hotspot.

## 7. Keep Raspberry Connected (Modem + Hotspot)

Add multiple WiFi profiles with priorities:

```bash
cd /opt/TI84-ESP32-GEMINI
sudo bash scripts/pi/configure_pi_wifi.sh add "MiModemCasa" "clave_modem" 90
sudo bash scripts/pi/configure_pi_wifi.sh add "MiHotspot" "clave_hotspot" 70
sudo bash scripts/pi/configure_pi_wifi.sh list
sudo bash scripts/pi/configure_pi_wifi.sh status
```

Notes:

- Higher priority connects first if both are available.
- If modem is down, Pi can connect to hotspot automatically.
- ESP32 and Raspberry must be clients of the same network (same hotspot or same modem) to communicate.

## Optional: Remote Access Without Port Forwarding

Install Tailscale:

```bash
cd TI84-ESP32-GEMINI
sudo bash scripts/pi/install_tailscale.sh
sudo tailscale up
```

Then manage Pi securely from phone anywhere.

## Updates

To update backend from GitHub:

```bash
cd /opt/TI84-ESP32-GEMINI
sudo bash scripts/pi/update_pi_backend.sh
```

## AP + Internet Note

Pi Zero 2 W has a single onboard WiFi.

- Client mode only (recommended): stable.
- For this project, Raspberry does not need AP mode because ESP32 already provides AP `calc` for setup.
- Keep Raspberry in client mode and connect both devices to same modem/hotspot.
