# agy-rest 🚀

REST and OpenAI-compatible API gateway for **Google Antigravity CLI (`agy`)**, built using **[Hono](https://hono.dev/)** and TypeScript.

Turn your local Antigravity CLI into a remote API server with full support for real-time Server-Sent Events (SSE) streaming, multi-turn conversations, and standard OpenAI client integration.

---

## 🌟 Features

- ⚡ **Lightweight & Blazing Fast:** Powered by Hono and Node.js.
- 🤖 **OpenAI API Compatible:** Exposes `/v1/chat/completions` and `/v1/models` so you can plug it directly into Chatbox, NextChat, Open WebUI, Cursor, or LangChain.
- 🌊 **Real-Time Streaming:** Full SSE support for token-by-token streaming responses.
- 🧠 **Multi-Model Support:** Easily route to `gemini-3.8-flash-high`, `claude-sonnet-4-6`, `gpt-oss-120b`, etc.
- 🔄 **Conversation Resumption:** Pass `conversation_id` to continue prior conversations across multiple turns.
- 🛡️ **Optional API Key Auth:** Protect your server using Bearer token authentication.

---

## 📚 Documentation & Integration Guides

- **[🔑 API Key Setup Guide (Panduan API Key)](./docs/API_KEY_SETUP.md)**
- **[📱 Client Integration Guide (Python, Node.js, Chatbox, NextChat)](./docs/CLIENT_INTEGRATION.md)**
- **[📑 Docs Overview (Daftar Isi Dokumentasi)](./docs/README.md)**

---

## 📦 Quick Start

### 1. Requirements

- Node.js >= 20
- `pnpm` (`npm install -g pnpm`)
- Antigravity CLI (`agy`) installed and authenticated on the machine.

### 2. Install & Run

```bash
cd /srv/www/agy-rest

# Install dependencies
pnpm install

# Run development mode
pnpm run dev

# Build & Run production mode
pnpm run build
pnpm start
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env`:

```env
PORT=8060
HOST=0.0.0.0
AGY_PATH=/home/roby/.local/bin/agy

# Optional: Set an API key (requests must include Authorization: Bearer <key>)
# API_KEY=your-secret-api-key
```

---

## 📡 API Endpoints

### 1. Service Info & Health
- `GET /` — Service overview and endpoints
- `GET /health` — Health check endpoint
- `GET /v1/models` — List available models in OpenAI format

---

### 2. OpenAI-Compatible Chat (`POST /v1/chat/completions`)

Works out-of-the-box with any OpenAI client library.

#### Non-Streaming Example:
```bash
curl -X POST http://localhost:8060/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [
      {"role": "user", "content": "Jelaskan apa itu REST API dalam satu kalimat!"}
    ]
  }'
```

#### Streaming Example (SSE):
```bash
curl -N -X POST http://localhost:8060/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [
      {"role": "user", "content": "Tuliskan puisi pendek tentang coding."}
    ],
    "stream": true
  }'
```

---

### 3. Native Antigravity Chat (`POST /api/chat`)

Direct access to Antigravity CLI features.

#### Request Body:
```json
{
  "prompt": "Fix bug in index.ts",
  "model": "gemini-3.8-flash-high",
  "stream": true,
  "conversation_id": "optional-uuid-to-continue",
  "effort": "high",
  "mode": "auto",
  "dangerously_skip_permissions": false
}
```

---

## 🔧 Production Setup (Systemd Service)

To run `agy-rest` as a persistent background service:

1. Create `/etc/systemd/system/agy-rest.service`:
```ini
[Unit]
Description=Antigravity REST Gateway (agy-rest)
After=network.target

[Service]
Type=simple
User=roby
WorkingDirectory=/srv/www/agy-rest
Environment=PORT=8060
Environment=HOST=0.0.0.0
Environment=PATH=/home/roby/.nvm/versions/node/v26.13.0/bin:/home/roby/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/roby/.nvm/versions/node/v26.13.0/bin/node /srv/www/agy-rest/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

2. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agy-rest
sudo systemctl status agy-rest
```

---

## 🌐 Nginx Reverse Proxy Example

```nginx
server {
    server_name roby-agy.mooo.com;

    location / {
        proxy_pass http://127.0.0.1:8060;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for SSE streaming
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

---

## 📄 License

MIT
