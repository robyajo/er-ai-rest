# ☁️ Antigravity (agy) Module & API Guide

Modul **Antigravity (`agy`)** pada `er-ai-rest` menyediakan antarmuka REST dan OpenAI-compatible untuk mengakses model-model penalaran cloud tingkat lanjut dari Google Antigravity CLI (`agy`), seperti **Gemini 3.8 Flash**, **Claude Sonnet 4.6**, dan **GPT-OSS 120B**.

---

## 🚀 Prefix Route & Endpoints

Semua endpoint khusus Antigravity diprefiks dengan rute `/agy`:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/agy/models` | Daftar model live Antigravity dari CLI (format JSON sederhana) |
| `GET` | `/agy/v1/models` | Daftar model Antigravity dalam format standar **OpenAI Model List** |
| `POST` | `/agy/api/chat` | Endpoint native Antigravity (mendukung `conversation_id`, `effort`, mode editing, dan streaming SSE) |
| `POST` | `/agy/v1/chat/completions` | **OpenAI Chat Completions API** (Kompatibel 100% dengan OpenAI clients) |

> 💡 **Unified Gateway Alternative**: Anda juga dapat memanggil rute universal:
> - `POST /v1/chat/completions`: Secara cerdas mengarahkan ke Antigravity jika memilih model cloud.
> - `POST /v1/completions`: Otomatis mengonversi prompt teks ke struktur pesan Antigravity dan mengembalikan format OpenAI completion.

---

## 🔑 Autentikasi Khusus Antigravity

Endpoint di bawah `/agy/*` dilindungi token autentikasi. Anda dapat menggunakan:
- **`AGY_API_KEY`** (misal: `sk-agy-cloud-token-8060`) — Kunci khusus Antigravity cloud.
- **`API_KEY`** (Master Key) — Kunci utama pengelola untuk akses seluruh modul.

> ⚠️ **Catatan Keamanan**: Klien yang menggunakan `LLAMA_API_KEY` akan **ditolak (403 Forbidden)** saat mengakses rute `/agy/*` guna melindungi kuota dan akses model cloud Anda.

---

## 🌐 Host & Base URL

| Lingkungan | Base URL OpenAI Compatible | Dedicated Antigravity Base URL |
| :--- | :--- | :--- |
| **Produksi (VPS)** | `https://er-ai-api.mooo.com/v1` | `https://er-ai-api.mooo.com/agy/v1` |
| **Lokal (Dev)** | `http://localhost:8060/v1` | `http://localhost:8060/agy/v1` |

---

## 🧠 Daftar Model yang Didukung

- `gemini-3.8-flash-high` *(Default, kecepatan sangat tinggi + penalaran mendalam)*
- `gemini-3.8-flash-medium`
- `gemini-3.8-flash-low`
- `claude-sonnet-4-6` *(Anthropic Claude dengan kapabilitas thinking)*
- `claude-opus-4-6-thinking` *(Anthropic Claude Opus thinking powerhouse)*
- `gpt-oss-120b-medium` *(Open-weights 120B model)*

---

## 💻 Contoh Penggunaan

### 1. cURL (Streaming OpenAI Chunk)

```bash
curl -N -X POST https://er-ai-api.mooo.com/agy/v1/chat/completions \
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
    base_url="https://er-ai-api.mooo.com/agy/v1",  # Arahkan ke prefix /agy/v1
    api_key="sk-agy-cloud-token-8060"
)

response = client.chat.completions.create(
    model="gemini-3.8-flash-high",
    messages=[
        {"role": "user", "content": "Tuliskan fungsi Fibonacci di Python lengkap dengan type hints!"}
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
  baseURL: 'https://er-ai-api.mooo.com/agy/v1',
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

### 4. Native Chat dengan Riwayat Sesi & Kontrol Reasoning (`/agy/api/chat`)

Layanan native mendukung parameter `conversation_id` untuk melanjutkan percakapan multi-turn dan `effort` untuk mengatur tingkat penalaran AI:

```bash
curl -X POST https://er-ai-api.mooo.com/agy/api/chat \
  -H "Authorization: Bearer sk-agy-cloud-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Lanjutkan analisis performa database kemarin",
    "model": "gemini-3.8-flash-high",
    "conversation_id": "f6fd9242-95a9-4e4d-9763-7e1059a6cf6c",
    "effort": "high"
  }'
```

Pilihan nilai `effort`:
- `low`: Cepat, hemat komputasi, cocok untuk pertanyaan faktual pendek.
- `medium`: Keseimbangan antara penalaran dan kecepatan.
- `high`: Penalaran mendalam, analisis logika, atau pemecahan masalah kompleks.
- `max`: Kapasitas analisis tertinggi untuk arsitektur dan debugging kode rumit.
