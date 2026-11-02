# agy-rest 🚀

Modular REST and OpenAI-compatible API gateway for **Google Antigravity CLI (`agy`)** and **llama.cpp (Local GGUF models)**, built using **[Hono](https://hono.dev/)** and TypeScript.

Turn your local Antigravity CLI or local GGUF models into an enterprise-grade API server with full support for real-time Server-Sent Events (SSE) streaming, role-based key separation, multi-turn conversations, and standard OpenAI client integration.

---

## 🌟 Features

- ⚡ **Lightweight & Blazing Fast:** Powered by Hono and Node.js.
- 🧩 **Modular Route Architecture:**
  - Dedicated `/agy/*` prefix for Antigravity cloud models.
  - Dedicated `/llama/*` prefix for llama.cpp local models.
  - Unified `/v1/*` smart gateway routing automatically based on model.
- 🦙 **Dual-Engine Support:** Seamlessly route between **Google Antigravity (`agy`)** and **llama.cpp** (local GGUF models via server or CLI).
- 🛡️ **Role-Based Token Segregation:** Dedicated `AGY_API_KEY` (cloud only), `LLAMA_API_KEY` (local only), and `API_KEY` (Master).
- 🤖 **OpenAI API Compatible:** Exposes `/v1/chat/completions` and `/v1/models` so you can plug it directly into Chatbox, NextChat, Open WebUI, Cursor, or LangChain.
- 🌊 **Real-Time Streaming:** Full SSE support for token-by-token streaming responses across all engines.
- 🚀 **VPS Ready:** Equipped with automated `./finis.sh` deployment & cache cleanup script.

---

## 📚 Documentation & Modules

- **[☁️ Antigravity Module Guide (`/agy/*`)](./docs/agy/README.md)**
- **[🦙 llama.cpp Module Guide (`/llama/*`)](./docs/llama/README.md)**
- **[🔑 API Key Setup & Role Separation Guide](./docs/API_KEY_SETUP.md)**
- **[📱 Client Integration Guide (Python, Node.js, Chatbox, NextChat)](./docs/CLIENT_INTEGRATION.md)**
- **[📑 Docs Overview (Daftar Isi Dokumentasi)](./docs/README.md)**

---

## 📦 Quick Start & VPS Deployment

### 1. Requirements

- Node.js >= 20
- `pnpm` (`npm install -g pnpm`)
- Antigravity CLI (`agy`) and/or `llama.cpp` (`llama` / `llama-server`) installed.

### 2. Automated VPS Build & Cache Cleanup (`finis.sh`)

Untuk deploy atau update di server/VPS:

```bash
chmod +x finis.sh
./finis.sh
```

Skrip ini secara otomatis:
1. Membersihkan cache build lama (`dist/`, `tsconfig.tsbuildinfo`, `.cache`).
2. Menginstal dan memvalidasi seluruh dependensi via `pnpm`.
3. Membangun TypeScript menjadi JavaScript produksi yang dioptimalkan.
4. Me-restart systemd service `agy-rest` (jika berjalan di Linux VPS).
5. Menjalankan pengujian health check otomatis.

---

## ⚙️ Configuration

Copy `.env.example` to `.env`:

```env
PORT=8060
HOST=0.0.0.0

# Master Key (Akses ke semua model)
API_KEY=your-master-api-key

# Kunci khusus Antigravity (Gemini, Claude, GPT-OSS)
AGY_API_KEY=your-antigravity-api-key

# Kunci khusus llama.cpp (Model GGUF lokal offline)
LLAMA_API_KEY=your-llamacpp-api-key

# Default Engine Provider ('agy' or 'llamacpp')
DEFAULT_PROVIDER=agy

# Antigravity CLI Path
AGY_PATH=/home/roby/.local/bin/agy

# llama.cpp Configuration
LLAMA_CPP_BASE_URL=http://127.0.0.1:8080
LLAMA_BIN=/home/roby/.local/bin/llama
LLAMA_MODEL_PATH=/path/to/your/model.gguf
```

---

## 📡 API Endpoints Overview

| Modul | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| **Antigravity** | `POST /agy/v1/chat/completions`<br>`GET /agy/v1/models` | Rute khusus model cloud Antigravity |
| **llama.cpp** | `POST /llama/v1/chat/completions`<br>`GET /llama/v1/models`<br>`GET /llama/status` | Rute khusus model lokal GGUF offline |
| **Unified Gateway** | `POST /v1/chat/completions`<br>`GET /v1/models`<br>`POST /api/chat`<br>`GET /health` | Rute pintar otomatis yang mengarahkan kueri berdasarkan model |

---

## 📄 License

MIT License.
