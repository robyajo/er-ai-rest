# ☁️ Antigravity (agy) Module & API Guide

Modul **Antigravity (`agy`)** menyediakan antarmuka REST dan OpenAI-compatible untuk mengakses model-model penalaran cloud tingkat lanjut dari Google Antigravity CLI (`agy`), seperti **Gemini 3.8 Flash**, **Claude Sonnet 4.6**, dan **GPT-OSS 120B**.

---

## 🚀 Prefix Route & Endpoints

Semua endpoint khusus Antigravity diprefiks dengan rute `/agy`:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/agy/models` | Daftar model bawaan Antigravity (format JSON sederhana) |
| `GET` | `/agy/v1/models` | Daftar model Antigravity dalam format standar **OpenAI** |
| `POST` | `/agy/api/chat` | Endpoint native Antigravity (mendukung `conversation_id`, `effort`, dan streaming SSE) |
| `POST` | `/agy/v1/chat/completions` | Endpoint kompatibel 100% **OpenAI Chat Completions API** |

---

## 🔑 Autentikasi Khusus Antigravity

Endpoint di bawah `/agy/*` dilindungi dengan token autentikasi. Anda dapat menggunakan:
- **`AGY_API_KEY`** (misal: `sk-agy-cloud-token-8060`) — Kunci khusus Antigravity.
- **`API_KEY`** (Master Key) — Kunci utama pengelola.

> ⚠️ **Catatan Keamanan**: Klien yang menggunakan `LLAMA_API_KEY` akan **ditolak (403 Forbidden)** saat mengakses rute `/agy/*` guna melindungi kuota cloud Anda.

---

## 🧠 Daftar Model yang Didukung

- `gemini-3.8-flash-high` *(Default, kecepatan tinggi + penalaran mendalam)*
- `gemini-3.8-flash-medium`
- `gemini-3.8-flash-low`
- `claude-sonnet-4-6` *(Anthropic Claude dengan thinking capabilities)*
- `claude-opus-4-6-thinking` *(Anthropic Claude Opus thinking powerhouse)*
- `gpt-oss-120b-medium` *(Open-weights 120B model)*

---

## 💻 Contoh Penggunaan

### 1. cURL (Streaming OpenAI Chunk)

```bash
curl -N -X POST http://localhost:8060/agy/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-cloud-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [
      {"role": "user", "content": "Jelaskan konsep arsitektur microservices dalam 3 poin!"}
    ],
    "stream": true
  }'
```

---

### 2. Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8060/agy/v1", # Arahkan ke prefix /agy/v1
    api_key="sk-agy-cloud-token-8060"
)

response = client.chat.completions.create(
    model="gemini-3.8-flash-high",
    messages=[
        {"role": "user", "content": "Tuliskan fungsi Fibonacci di Python"}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
print()
```

---

### 3. Node.js / TypeScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8060/agy/v1',
  apiKey: 'sk-agy-cloud-token-8060',
});

async function run() {
  const stream = await client.chat.completions.create({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'Halo Claude!' }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
}

run();
```

---

### 4. Native Chat dengan Riwayat Sesi (`/agy/api/chat`)

Layanan native mendukung parameter `conversation_id` untuk melanjutkan percakapan:

```bash
curl -X POST http://localhost:8060/agy/api/chat \
  -H "Authorization: Bearer sk-agy-cloud-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Lanjutkan analisis performa database kemarin",
    "model": "gemini-3.8-flash-high",
    "conversation_id": "f6fd9242-95a9-4e4d-9763-7e1059a6cf6c",
    "effort": "high"
  }'
```
