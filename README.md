# agy-rest 🚀

REST and OpenAI-compatible API gateway for **Google Antigravity CLI (`agy`)** and **llama.cpp (Local GGUF models)**, built using **[Hono](https://hono.dev/)** and TypeScript.

Turn your local Antigravity CLI or local GGUF models into a unified remote API server with full support for real-time Server-Sent Events (SSE) streaming, multi-turn conversations, and standard OpenAI client integration.

---

## 🌟 Features

- ⚡ **Lightweight & Blazing Fast:** Powered by Hono and Node.js.
- 🦙 **Dual-Engine Support:** Seamlessly route between **Google Antigravity (`agy`)** and **llama.cpp** (local GGUF models via server or CLI).
- 🤖 **OpenAI API Compatible:** Exposes `/v1/chat/completions` and `/v1/models` so you can plug it directly into Chatbox, NextChat, Open WebUI, Cursor, or LangChain.
- 🌊 **Real-Time Streaming:** Full SSE support for token-by-token streaming responses across both engines.
- 🧠 **Multi-Model Support:** Route to `gemini-3.8-flash-high`, `claude-sonnet-4-6`, `qwen3.5-0.8b`, `llama-3.2-3b`, custom `.gguf`, etc.
- 🔄 **Conversation Resumption:** Pass `conversation_id` to continue prior conversations across multiple turns.
- 🛡️ **Optional API Key Auth:** Protect your server using Bearer token authentication.

---

## 📚 Documentation & Integration Guides

- **[🔑 API Key Setup Guide (Panduan API Key)](./docs/API_KEY_SETUP.md)**
- **[📱 Client Integration Guide (Python, Node.js, Chatbox, NextChat, Llama.cpp)](./docs/CLIENT_INTEGRATION.md)**
- **[📑 Docs Overview (Daftar Isi Dokumentasi)](./docs/README.md)**

---

## 📦 Quick Start

### 1. Requirements

- Node.js >= 20
- `pnpm` (`npm install -g pnpm`)
- Antigravity CLI (`agy`) and/or `llama.cpp` (`llama` / `llama-server`) installed.

### 2. Install & Run

```bash
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

# Optional: Bearer Token Authentication
# API_KEY=your-secret-api-key

# Default Engine Provider ('agy' or 'llamacpp')
DEFAULT_PROVIDER=agy

# Antigravity CLI Path
AGY_PATH=/home/roby/.local/bin/agy

# llama.cpp Configuration
# Mode 1: Connect to llama-server HTTP API
LLAMA_CPP_BASE_URL=http://127.0.0.1:8080

# Mode 2: Direct CLI binary fallback
LLAMA_BIN=/Users/robykartis/.local/bin/llama
LLAMA_MODEL_PATH=/path/to/your/model.gguf
```

---

## 📡 API Endpoints

### 1. Service Info & Health

- `GET /` — Service overview, status, and active engine providers
- `GET /health` — Health check endpoint with provider connectivity status
- `GET /v1/models` — List all available models (Antigravity + llama.cpp local models)

---

### 2. OpenAI-Compatible Chat (`POST /v1/chat/completions`)

Works out-of-the-box with any OpenAI client library.

#### A. Antigravity Cloud Models Example:

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

#### B. llama.cpp Local GGUF Model Example:

```bash
curl -X POST http://localhost:8060/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Halo! Siapa kamu?"}
    ]
  }'
```

#### C. Streaming Example (SSE):

```bash
curl -N -X POST http://localhost:8060/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Tuliskan tips belajar coding."}
    ],
    "stream": true
  }'
```

---

### 3. Direct Chat API (`POST /api/chat`)

Direct access to CLI features and streaming events.

#### Request Body:

```json
{
  "prompt": "Optimize database query",
  "model": "qwen3.5-0.8b",
  "provider": "llamacpp",
  "stream": true,
  "max_tokens": 1024
}
```

---

## 📄 License

MIT License.
