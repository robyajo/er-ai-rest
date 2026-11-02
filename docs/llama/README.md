# 🦙 llama.cpp Module & API Guide (Local GGUF Models)

Modul **llama.cpp** pada `er-ai-rest` menyediakan antarmuka REST dan OpenAI-compatible berkecepatan tinggi untuk menjalankan model-model kecerdasan artifisial lokal (format GGUF) secara offline langsung pada server/perangkat Anda tanpa ketergantungan internet.

---

## 🚀 Prefix Route & Endpoints

Semua endpoint khusus llama.cpp dapat diakses dengan rute `/llama`:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/llama/status` | Status engine llama.cpp (`server_connected` atau `cli_fallback`) |
| `GET` | `/llama/models` | Daftar model lokal yang tersedia (format JSON ringkas) |
| `GET` | `/llama/v1/models` | Daftar model lokal dalam format standar **OpenAI Model List** |
| `POST` | `/llama/v1/chat/completions` | **OpenAI Chat Completions API** (High-speed sub-second direct stream) |
| `POST` | `/llama/v1/completions` | **OpenAI Text Completions API** (Cocok untuk code completion / prompt tools) |
| `POST` | `/llama/completion` | Endpoint komplesi native biner `llama.cpp` |
| `GET` | `/llama/props` | Konfigurasi aktif dan parameter server `llama.cpp` |
| `GET` | `/llama/slots` | Status alokasi slot konkurensi dan KV cache similarity |
| `POST` | `/llama/api/chat` | Endpoint percakapan format JSON sederhana |

> 💡 **Unified Gateway Alternative**: Anda juga dapat memanggil rute universal `/v1/chat/completions` dan `/v1/completions`. Sistem secara cerdas akan otomatis mengarahkan request ke mesin llama.cpp jika nama model menargetkan model lokal.

---

## ⚡ Arsitektur Direct-Stream Berkecepatan Tinggi (~300ms)

Modul ini telah dioptimalkan secara mendalam untuk menyamai performa native proxy Nginx:
1. **Transmisi Langsung (Direct SSE Pipeline)**: Potongan token (*chunk*) dialirkan langsung tanpa overhead de-serialisasi/re-serialisasi JSON di Node.js.
2. **In-Memory Alias Resolver (0 ms)**: Alias model (`qwen3.5-0.8b`, `qwen`, `local-gguf`, `default`) dipetakan secara instan ke model aktif di router (`Qwen3.5-0.8B-Q8_0`) tanpa perlu menjalankan pengecekan HTTP ganda berulang kali.
3. **Preservasi Penalaran (*Reasoning Tokens*)**: Mendukung token penalaran terpisah (`reasoning_content`) pada model reasoning seperti **Qwen 3.5** dan **DeepSeek R1**.
4. **Kontrol Mode Berpikir (*Thinking Mode Toggle*)**: Anda dapat mematikan atau mengaktifkan mode berpikir melalui `chat_template_kwargs`.

---

## 🔑 Autentikasi Khusus llama.cpp

Endpoint di bawah `/llama/*` dilindungi token autentikasi. Anda dapat menggunakan:
- **`LLAMA_API_KEY`** (misal: `sk-llama-local-token-8060`) — Kunci khusus model lokal.
- **`API_KEY`** (Master Key) — Kunci utama pengelola untuk akses seluruh mesin.

> ⚠️ **Pemisahan Hak Akses**: Token `AGY_API_KEY` akan **ditolak (403 Forbidden)** pada rute `/llama/*`. Sebaliknya, token `LLAMA_API_KEY` hanya dapat mengakses model lokal dan tidak dapat mengonsumsi kuota cloud Antigravity.

---

## 🌐 Host & Base URL

| Lingkungan | Base URL OpenAI Compatible | Dedicated Llama Base URL |
| :--- | :--- | :--- |
| **Produksi (VPS)** | `https://er-ai-api.mooo.com/v1` | `https://er-ai-api.mooo.com/llama/v1` |
| **Lokal (Dev)** | `http://localhost:8060/v1` | `http://localhost:8060/llama/v1` |

*(Pengganti langsung domain lama `roby-llama.mooo.com`)*.

---

## 🧠 Model Lokal yang Tersedia

- `Qwen3.5-0.8B-Q8_0` *(Model aktif dengan latensi terendah dan akurasi tinggi)*
- `qwen3.5-0.8b` *(Alias resmi untuk Qwen 3.5)*
- `llama-3.2-1b` *(Model Meta Llama 3.2 1B Instruct)*
- `llama-3.2-3b` *(Model Meta Llama 3.2 3B Instruct)*
- `mistral-7b` *(Model serbaguna untuk instruksi kompleks)*
- `deepseek-r1-distill-qwen-7b` *(Model penalaran logika mendalam)*
- `local-gguf` *(Alias untuk model default sistem)*

---

## 💻 Contoh Penggunaan & Integrasi

### 1. Chat Completions dengan Streaming (cURL)

```bash
curl -N -X POST https://er-ai-api.mooo.com/llama/v1/chat/completions \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "system", "content": "Jawab singkat dan padat dalam Bahasa Indonesia."},
      {"role": "user", "content": "Apa itu fotosintesis?"}
    ],
    "max_tokens": 100,
    "stream": true,
    "chat_template_kwargs": {
      "enable_thinking": false
    }
  }'
```

---

### 2. OpenAI Text Completions (`/llama/v1/completions`)

Endpoint ini ideal untuk integrasi pelengkap kode otomatis (misal: plugin Cursor, Continue.dev, Copilot tools):

```bash
curl -X POST https://er-ai-api.mooo.com/llama/v1/completions \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "prompt": "def hitung_luas_lingkaran(r):\n    return",
    "max_tokens": 30,
    "temperature": 0.2
  }'
```

---

### 3. Native Llama Completion (`/llama/completion`)

Endpoint langsung biner `llama.cpp` dengan kontrol parameter generasi penuh:

```bash
curl -X POST https://er-ai-api.mooo.com/llama/completion \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Indonesia beribukota di",
    "n_predict": 10,
    "temperature": 0.7
  }'
```

---

### 4. Integrasi Python (OpenAI SDK)

```python
from openai import OpenAI

# Sambungkan ke https://er-ai-api.mooo.com/llama/v1
client = OpenAI(
    base_url="https://er-ai-api.mooo.com/llama/v1",
    api_key="sk-llama-local-token-8060"
)

# 1. Mode Chat Completions
response = client.chat.completions.create(
    model="qwen3.5-0.8b",
    messages=[
        {"role": "system", "content": "Anda adalah asisten AI yang cerdas."},
        {"role": "user", "content": "Berikan 3 tips belajar pemrograman!"}
    ],
    stream=True,
    extra_body={
        "chat_template_kwargs": {"enable_thinking": False}  # Matikan thinking agar jawaban langsung keluar
    }
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
print()

# 2. Mode Text Completions (Legacy / Coding)
completion = client.completions.create(
    model="qwen3.5-0.8b",
    prompt="1 + 1 = ",
    max_tokens=10
)
print("Hasil Completion:", completion.choices[0].text)
```

---

### 5. Integrasi Node.js / TypeScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://er-ai-api.mooo.com/llama/v1',
  apiKey: 'sk-llama-local-token-8060',
});

async function main() {
  const stream = await client.chat.completions.create({
    model: 'qwen3.5-0.8b',
    messages: [{ role: 'user', content: 'Halo Llama!' }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
  console.log();
}

main().catch(console.error);
```

---

### 6. Pengecekan Slot & Diagnostik Server

Untuk melihat pemakaian memori KV cache dan alokasi slot aktif pada model:

```bash
# Cek alokasi slot aktif
curl -s "https://er-ai-api.mooo.com/llama/slots" \
  -H "Authorization: Bearer sk-llama-local-token-8060"

# Cek properti sistem dan parameter server
curl -s "https://er-ai-api.mooo.com/llama/props" \
  -H "Authorization: Bearer sk-llama-local-token-8060"
```
