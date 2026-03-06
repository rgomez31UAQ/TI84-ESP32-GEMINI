# TI84-ESP32-GEMINI

Proyecto unificado para usar una TI-84 + ESP32 con backend de IA multi-proveedor (Gemini como base y fallback opcional).

Base tomada de:

- `TI-GPT` (estructura PlatformIO + Gemini inicial)
- `TI-84-GPT-HACK` (protocolo TI robusto, funciones extra, servidor y ruta de camara)

Referencias:

- <https://github.com/ExodowRRGB/TI-GPT>
- <https://github.com/ChinesePrince07/TI-84-GPT-HACK>
- <https://www.andypandy.org/projects/ti-84-gpt-hack/>
- <https://andisearch.com/>

## Codigo exportado por origen

De `TI-84-GPT-HACK` se exporto y adapto:

- `esp32/esp32.ino` -> `firmware/src/main.ino`
- `esp32/*.h` -> `firmware/include/*.h`
- `server/routes/*`, `server/index.mjs`, `server/firmware`, `server/images`, `server/programs`, `server/version.txt`

De `TI-GPT` se tomo la idea de compilacion en PlatformIO y llamada a Gemini para dejar esta version integrada.

## Mejor opcion practica

1. Backend en nube (URL HTTPS publica y estable).
1. ESP32 con portal AP para configurar WiFi/hotspot desde telefono.
1. Cadena de IA con fallback: `gemini -> groq -> openrouter`.

Este enfoque evita depender de una laptop encendida 24/7 y mantiene el proyecto open-source y de bajo costo.

## Estructura

- `firmware/`: proyecto PlatformIO para el ESP32
- `server/`: backend Node.js con rutas compatibles (`/gpt`, `/programs`, `/image`, `/firmware`, `/logs`)
- `render.yaml`: blueprint para desplegar rapido en Render

## Firmware (ESP32)

1. Ve a `firmware/platformio.ini` y ajusta tu placa si hace falta.
1. El archivo ya trae 2 perfiles:
1. `xiao_esp32c3_local` (backend local)
1. `xiao_esp32c3_cloud` (backend en Render con HTTPS)
1. Compila y sube (ejemplo cloud):

```bash
cd firmware
pio run -e xiao_esp32c3_cloud -t upload
```

Para local:

```bash
cd firmware
pio run -e xiao_esp32c3_local -t upload
```

Cableado tipico (ajustar segun tu placa):

- TIP: GPIO configurado en `main.ino` (`TIP`)
- RING: GPIO configurado en `main.ino` (`RING`)
- SLEEVE: GND

## Servidor (Multi-IA)

1. Instala dependencias:

```bash
cd server
npm install
```

1. Crea `.env` desde `.env.example` y pon tu key de Google AI Studio.

1. Opcional: agrega keys de fallback (Groq/OpenRouter) para no caerte por cuota de un solo proveedor.

1. Inicia el servidor:

```bash
npm start
```

El firmware consulta estas rutas:

- `GET /gpt/ask`
- `GET /gpt/history`
- `POST /gpt/solve` (vision/camara)

### Variables clave de `.env`

- `AI_PROVIDER_ORDER=gemini,groq,openrouter`
- `GOOGLE_API_KEY=...`
- `GROQ_API_KEY=...` (opcional)
- `OPENROUTER_API_KEY=...` (opcional)

## Despliegue en nube

### Opcion recomendada para empezar (gratis/freemium): Render

1. Sube este proyecto a GitHub.
1. En Render, usa `New + -> Blueprint` y selecciona este repo (usa `render.yaml`).
1. Si no usas Blueprint, crea `Web Service` manual con:
1. Root Directory: `server`
1. Build Command: `npm install`
1. Start Command: `npm start`
1. Health Check Path: `/healthz`
1. Variables de entorno: copia las de `.env.example`.
1. Despliega y copia la URL HTTPS publica.

Si ya tienes cuenta Render con GitHub conectada, este flujo suele tardar solo unos minutos.

Luego, en `firmware/platformio.ini`, define por ejemplo:

```ini
build_flags = -D SERVER=\"https://tu-app.onrender.com\" -D SECURE
```

### Otras nubes gratuitas o freemium recomendadas

1. Render: muy facil para Node.js, plan gratis con sleep por inactividad.
1. Railway: simple de usar, normalmente con creditos gratis temporales.
1. Koyeb: tiene plan free para servicios pequenos.
1. Fly.io: muy bueno tecnicamente, pero puede requerir tarjeta o costos minimos segun region/uso.

### Railway (alternativa rapida)

1. Sube el repo a GitHub.
1. En Railway, crea `New Project -> Deploy from GitHub Repo`.
1. Selecciona carpeta `server` como root de servicio si Railway lo solicita.
1. Railway puede usar `server/railway.json` automaticamente.
1. Agrega variables de entorno de `.env.example`.

### Docker (portabilidad)

`server/Dockerfile` y `server/.dockerignore` estan incluidos para despliegue en cualquier proveedor con contenedores.

## Publicar en GitHub (manual)

Repositorio remoto configurado:

- `origin = https://github.com/rgomez31UAQ/TI84-ESP32-GEMINI.git`

Si el repo aun no existe, crealo en GitHub con ese nombre y luego ejecuta:

```bash
cd TI84-ESP32-GEMINI
git push -u origin main
```

Si Git pide autenticacion por HTTPS, usa un token personal (PAT) con permisos de `repo`.

## Red para el ESP32

1. El ESP32 puede crear AP (`calc`) para configuracion inicial.
1. Desde ese portal puedes conectarlo a WiFi normal o hotspot de telefono.
1. Desde ese mismo portal puedes definir la URL del backend (Render/Railway) sin recompilar firmware.
1. Para movilidad, hotspot del telefono es la opcion mas practica.
1. Para uso continuo, WiFi fijo + backend en nube es la opcion mas estable.

### Seguridad recomendada

1. No guardes API keys de IA en el ESP32: deben quedarse solo en el backend de nube.
1. En el portal AP configura solo `WiFi` y `Backend URL`.
1. Rota tus keys (GitHub/Gemini/Groq/OpenRouter) si las compartes en texto plano.

## Siguiente paso operativo

1. Desplegar backend en Render o Railway y obtener URL publica HTTPS.
1. Ajustar `firmware/platformio.ini` con:

```ini
build_flags = -D SERVER=\"https://TU-URL-PUBLICA\" -D SECURE
```

1. Compilar/subir firmware y configurar WiFi del ESP32 desde el portal AP `calc`.
1. Verificar backend en `https://TU-URL-PUBLICA/healthz` antes de probar desde la calculadora.

## Notas

- El endpoint de firmware es compatible con el protocolo de `TI-84-GPT-HACK`.
- Para respuestas en pantalla TI-84, el backend aplica saneo a ASCII y mayusculas.
- Soporte de camara queda como feature opcional en firmware (`#define CAMERA`).
- Si un proveedor de IA falla por cuota, el servidor intenta el siguiente en `AI_PROVIDER_ORDER`.

## Aviso

Usa este proyecto de forma etica y respetando politicas academicas y legales.
