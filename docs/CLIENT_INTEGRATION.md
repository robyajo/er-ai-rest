# 📱 Panduan Integrasi Klien Eksternal

Server **`er-ai-rest`** menyediakan antarmuka 100% kompatibel dengan standar **OpenAI Chat Completions API** dan **Text Completions API**. Ini memungkinkan Anda mengintegrasikannya dengan mudah ke berbagai aplikasi AI populer atau kode kustom Anda cukup dengan memasukkan **Base URL** dan **API Key**, serta memilih engine antara **Antigravity CLI (Cloud)** atau model lokal **llama.cpp (Local GGUF)**.

---

## 🌐 Parameter Sambungan Utama

- **Base URL Gateway Universal:** `https://er-ai-api.mooo.com/v1` (atau `http://localhost:8060/v1`)
- **Base URL Khusus Antigravity:** `https://er-ai-api.mooo.com/agy/v1`
- **Base URL Khusus Llama.cpp:** `https://er-ai-api.mooo.com/llama/v1`
- **API Key Pilihan:**
  - `API_KEY` (Master Key): Akses penuh ke semua model (cloud & lokal).
  - `AGY_API_KEY`: Dibatasi hanya untuk model cloud Antigravity.
  - `LLAMA_API_KEY`: Dibatasi hanya untuk model lokal llama.cpp.

---

## 🔄 Panduan Migrasi dari `roby-llama.mooo.com`

Bagi Anda yang sebelumnya menggunakan `https://roby-llama.mooo.com`:

| Konfigurasi Lama | Konfigurasi Baru (`er-ai-rest`) |
| :--- | :--- |
| `https://roby-llama.mooo.com/v1` | **`https://er-ai-api.mooo.com/llama/v1`** atau **`https://er-ai-api.mooo.com/v1`** |
| Tanpa Auth / Token Bebas | Gunakan `sk-llama-local-token-8060` atau `sk-agy-roby-master-key-8060` |
| Model: `Qwen3.5-0.8B-Q8_0` | Bisa gunakan `Qwen3.5-0.8B-Q8_0` atau alias bersahabat `qwen3.5-0.8b` |
| Latensi | Tetap sub-detik (~300 ms) dengan transmisi direct stream zero-buffering |

---

## 1. Integrasi ke Aplikasi AI

### A. Chatbox App (Desktop & Mobile)

1. Buka aplikasi **Chatbox**.
2. Masuk ke menu **Settings** $\rightarrow$ **Model Provider**.
3. Pilih **OpenAI API**.
4. Masukkan parameter:
   - **API Host:** `https://er-ai-api.mooo.com`
   - **API Key:** `sk-agy-roby-master-key-8060` (atau token khusus Llama)
   - **Model:** `gemini-3.8-flash-high` atau model lokal `qwen3.5-0.8b`
5. Simpan dan mulai percakapan!

---

### B. NextChat (ChatGPT-Next-Web)

1. Buka website / desktop **NextChat**.
2. Masuk ke **Settings (Pengaturan)**.
3. Di bagian **Model Provider**, pilih **OpenAI**.
4. Isi konfigurasi:
   - **API Key:** `<TOKEN_ANDA>`
   - **OpenAI Endpoint / Proxy:** `https://er-ai-api.mooo.com` (atau dengan `/v1`)
5. Di bagian **Custom Models**, tambahkan daftar model:
   ```
   gemini-3.8-flash-high,claude-sonnet-4-6,qwen3.5-0.8b,llama-3.2-3b
   ```

---

### C. Open WebUI / LibreChat

1. Masuk ke halaman **Admin Panel** $\rightarrow$ **Settings** $\rightarrow$ **Connections**.
2. Tambahkan sambungan OpenAI baru:
   - **Base URL:** `https://er-ai-api.mooo.com/v1`
   - **API Key:** `<TOKEN_ANDA>`
3. Klik tombol **Verify Connection** atau simpan. Seluruh daftar model live Antigravity dan llama.cpp akan otomatis terdeteksi.

---

### D. Continue.dev / Cursor / Coding Assistant (Code Completion)

Untuk aplikasi bantuan coding yang membutuhkan pelengkapan baris kode otomatis (*inline autocomplete* / *tab completion*), gunakan endpoint **`/v1/completions`**:

Konfigurasi `config.json` pada Continue.dev:
```json
{
  "models": [
    {
      "title": "Local Qwen (er-ai-rest)",
      "provider": "openai",
      "model": "qwen3.5-0.8b",
      "apiBase": "https://er-ai-api.mooo.com/llama/v1",
      "apiKey": "sk-llama-local-token-8060"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete",
    "provider": "openai",
    "model": "qwen3.5-0.8b",
    "apiBase": "https://er-ai-api.mooo.com/llama/v1",
    "apiKey": "sk-llama-local-token-8060"
  }
}
```

---

## 2. Integrasi Menggunakan Bahasa Pemrograman

### A. Python (Official OpenAI SDK)

Pastikan paket `openai` terpasang (`pip install openai`):

#### 1. Chat Completions (Streaming dengan Matikan/Nyalakan Thinking)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://er-ai-api.mooo.com/v1",
    api_key="sk-agy-roby-master-key-8060"
)

response = client.chat.completions.create(
    model="qwen3.5-0.8b",
    messages=[
        {"role": "system", "content": "Jawab singkat dan padat dalam Bahasa Indonesia."},
        {"role": "user", "content": "Jelaskan apa itu gravitasi dalam 2 kalimat!"}
    ],
    stream=True,
    extra_body={
        # Matikan thinking mode agar jawaban langsung mengalir tanpa tag penalaran
        "chat_template_kwargs": {"enable_thinking": False}
    }
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
print()
```

#### 2. Text Completions (`client.completions.create`)

```python
completion = client.completions.create(
    model="qwen3.5-0.8b",
    prompt="def hitung_luas_persegi(sisi):\n    return",
    max_tokens=20,
    temperature=0.2
)

print("Hasil:", completion.choices[0].text)
```

---

### B. Node.js / TypeScript (Official OpenAI SDK)

Pastikan paket `openai` terpasang (`npm install openai`):

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://er-ai-api.mooo.com/v1",
  apiKey: "sk-agy-roby-master-key-8060",
});

async function main() {
  // 1. Chat Completions
  const chatStream = await client.chat.completions.create({
    model: "gemini-3.8-flash-high", // Atau "qwen3.5-0.8b" untuk lokal
    messages: [
      { role: "user", content: "Sebutkan 3 prinsip clean code!" }
    ],
    stream: true,
  });

  for await (const chunk of chatStream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
  console.log("\n");

  // 2. Text Completions
  const completion = await client.completions.create({
    model: "qwen3.5-0.8b",
    prompt: "1 + 1 = ",
    max_tokens: 5,
  });
  console.log("Completion:", completion.choices[0]?.text);
}

main().catch(console.error);
```

---

### C. cURL (Terminal / Bash)

#### 1. Streaming Chat Completions (`POST /v1/chat/completions`):

```bash
curl -N -X POST https://er-ai-api.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-roby-master-key-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Sebutkan 3 warna primer!"}
    ],
    "stream": true,
    "chat_template_kwargs": {
      "enable_thinking": false
    }
  }'
```

#### 2. Legacy Text Completions (`POST /v1/completions`):

```bash
curl -X POST https://er-ai-api.mooo.com/v1/completions \
  -H "Authorization: Bearer sk-agy-roby-master-key-8060" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "prompt": "Indonesia beribukota di",
    "max_tokens": 10
  }'
```
