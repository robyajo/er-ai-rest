# 🦙 llama.cpp Module & API Guide (Local GGUF Models)

Modul **llama.cpp** menyediakan antarmuka REST dan OpenAI-compatible untuk menjalankan model-model kecerdasan artifisial lokal (format GGUF) secara offline langsung pada perangkat komputer Anda tanpa ketergantungan internet.

---

## 🚀 Prefix Route & Endpoints

Semua endpoint khusus llama.cpp diprefiks dengan rute `/llama`:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/llama/status` | Status engine llama.cpp (`server_connected` atau `cli_fallback`) |
| `GET` | `/llama/models` | Daftar model lokal yang tersedia (format JSON sederhana) |
| `GET` | `/llama/v1/models` | Daftar model lokal dalam format standar **OpenAI** |
| `POST` | `/llama/api/chat` | Endpoint native llama.cpp (mendukung streaming SSE) |
| `POST` | `/llama/v1/chat/completions` | Endpoint kompatibel 100% **OpenAI Chat Completions API** |

---

## 🔑 Autentikasi Khusus llama.cpp

Endpoint di bawah `/llama/*` dilindungi dengan token autentikasi. Anda dapat menggunakan:
- **`LLAMA_API_KEY`** (misal: `sk-llama-local-token-8060`) — Kunci khusus model lokal.
- **`API_KEY`** (Master Key) — Kunci utama pengelola.

> ⚠️ **Catatan Keamanan**: Klien yang menggunakan `AGY_API_KEY` akan **ditolak (403 Forbidden)** saat mengakses rute `/llama/*`. Klien dengan `LLAMA_API_KEY` hanya dapat mengonsumsi model lokal tanpa biaya komputasi cloud.

---

## ⚙️ Dua Mode Eksekusi (Dual Engine Mode)

Modul ini secara otomatis memilih mode eksekusi terbaik:

1. **Mode 1: Server HTTP (`llama serve`)**
   - Jika Anda menjalankan server latar belakang seperti `llama serve -m <model.gguf> --port 8080`, gateway otomatis menghubunginya via HTTP API untuk latensi terendah.
2. **Mode 2: Eksekusi CLI Mandiri (`llama completion`)**
   - Jika server HTTP belum aktif, gateway langsung memanggil biner bawan `/home/roby/.local/bin/llama completion` secara mandiri.
   - Otomatis memindai file `.gguf` di direktori cache Hugging Face (`~/.cache/huggingface/hub/`) dan memuat model tanpa konfigurasi manual yang rumit.

---

## 🧠 Model Lokal yang Tersedia

- `qwen3.5-0.8b` *(Sangat ringan, respons instan, ideal untuk pengujian & edge computing)*
- `llama-3.2-1b` *(Model Meta Llama 3.2 1B Instruct)*
- `llama-3.2-3b` *(Model Meta Llama 3.2 3B Instruct)*
- `mistral-7b` *(Model serbaguna untuk instruksi kompleks)*
- `deepseek-r1-distill-qwen-7b` *(Model penalaran matematis & logis)*
- `local-gguf` *(Model default sesuai file GGUF yang terpasang)*

---

## 💻 Contoh Penggunaan

### 1. cURL (Streaming OpenAI Chunk)

```bash
curl -N -X POST http://localhost:8060/llama/v1/chat/completions \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Sebutkan 3 ibukota provinsi di Indonesia!"}
    ],
    "max_tokens": 50,
    "stream": true
  }'
```

---

### 2. Python (OpenAI SDK)

```python
from openai import OpenAI

# Arahkan base_url langsung ke prefix /llama/v1
client = OpenAI(
    base_url="http://localhost:8060/llama/v1",
    api_key="sk-llama-local-token-8060"
)

response = client.chat.completions.create(
    model="qwen3.5-0.8b",
    messages=[
        {"role": "user", "content": "Halo! Siapa kamu?"}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
print()
```

---

### 3. Integrasi ke Chatbox / NextChat

Bagi pengguna aplikasi obrolan AI:
1. **API Host / Base URL**: `http://localhost:8060/llama/v1`
2. **API Key**: `sk-llama-local-token-8060`
3. **Model**: `qwen3.5-0.8b`
