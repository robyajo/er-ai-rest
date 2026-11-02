# 📱 Panduan Integrasi Klien Menggunakan API Key

Server **`er-ai-rest`** menyediakan endpoint yang 100% kompatibel dengan **OpenAI Chat Completions API** dan **Completions API**. Ini memungkinkan Anda mengintegrasikannya ke berbagai aplikasi AI populer atau kode kustom Anda cukup dengan memasukkan **Base URL** dan **API Key**, serta memilih engine antara **Antigravity CLI** atau model lokal **llama.cpp**.

---

## 🌐 Informasi Parameter Sambungan

- **Base URL:** `https://er-ai-api.mooo.com/v1` (atau `http://localhost:8060/v1`)
- **API Key:** `<API_KEY_ANDA>` (yang disetel di `.env` / systemd)
- **Daftar Pilihan Model:**
  - **Model Antigravity (Cloud/Hybrid):**
    - `gemini-3.8-flash-high`
    - `gemini-3.8-flash-medium`
    - `gemini-3.8-flash-low`
    - `claude-sonnet-4-6`
    - `claude-opus-4-6-thinking`
    - `gpt-oss-120b-medium`
  - **Model llama.cpp (Local GGUF):**
    - `qwen3.5-0.8b`
    - `llama-3.2-1b`
    - `llama-3.2-3b`
    - `mistral-7b`
    - `deepseek-r1-distill-qwen-7b`
    - Path langsung ke file GGUF kustom atau model dari `llama-server`.

---

## 1. Integrasi ke Aplikasi AI Chat

### A. NextChat (ChatGPT-Next-Web)

1. Buka aplikasi / website **NextChat**.
2. Masuk ke **Settings (Pengaturan)**.
3. Di bagian **Model Provider**, pilih **OpenAI**.
4. Isi konfigurasi:
   - **API Key:** `sk-agy-rahasia-123456`
   - **OpenAI Endpoint / Proxy:** `https://er-ai-api.mooo.com` (atau dengan `/v1`)
5. Di bagian **Custom Models**, tambahkan: `gemini-3.8-flash-high,claude-sonnet-4-6,qwen3.5-0.8b,llama-3.2-3b`.

---

### B. Chatbox App (Desktop & Mobile)

1. Buka aplikasi **Chatbox**.
2. Masuk ke menu **Settings** $\rightarrow$ **Model Provider**.
3. Pilih **OpenAI API**.
4. Masukkan parameter:
   - **API Host:** `https://er-ai-api.mooo.com`
   - **API Key:** `sk-agy-rahasia-123456`
   - **Model:** `gemini-3.8-flash-high` (atau model lokal `qwen3.5-0.8b`)
5. Klik **Save** dan Anda sudah bisa mengobrol!

---

### C. Open WebUI / LibreChat

1. Masuk ke halaman **Admin Panel** $\rightarrow$ **Settings** $\rightarrow$ **Connections**.
2. Tambahkan sambungan OpenAI baru:
   - **Base URL:** `https://er-ai-api.mooo.com/v1`
   - **API Key:** `sk-agy-rahasia-123456`
3. Klik tombol **Verify Connection**.

---

## 2. Integrasi Menggunakan Kode Pemrograman

### A. Python (Official OpenAI SDK)

Pastikan paket `openai` terpasang (`pip install openai`):

```python
from openai import OpenAI

# Inisialisasi klien dengan Base URL dan API Key server Anda
client = OpenAI(
    base_url="https://er-ai-api.mooo.com/v1",
    api_key="sk-agy-rahasia-123456"
)

# 1. Panggilan dengan Streaming Menggunakan Model llama.cpp Lokal
response = client.chat.completions.create(
    model="qwen3.5-0.8b",
    messages=[
        {"role": "system", "content": "Anda adalah asisten cerdas yang ramah."},
        {"role": "user", "content": "Jelaskan apa itu gravitasi dalam satu kalimat!"}
    ],
    stream=True
)

print("Jawaban: ", end="")
for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
print()
```

---

### B. Node.js / TypeScript (Official OpenAI SDK)

Pastikan paket `openai` terpasang (`npm install openai`):

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://er-ai-api.mooo.com/v1",
  apiKey: "sk-agy-rahasia-123456",
});

async function main() {
  const stream = await client.chat.completions.create({
    model: "qwen3.5-0.8b",
    messages: [
      {
        role: "user",
        content: "Jelaskan perbedaan synchronous dan asynchronous!",
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
  console.log();
}

main().catch(console.error);
```

---

### C. cURL (Terminal / Bash)

#### Streaming Request (Gunakan flag `-N`):

```bash
curl -N -X POST https://er-ai-api.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-rahasia-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Sebutkan 3 distro Linux terpopuler!"}
    ],
    "stream": true
  }'
```

#### Non-Streaming Request (JSON Lengkap):

```bash
curl -X POST https://er-ai-api.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-rahasia-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-0.8b",
    "messages": [
      {"role": "user", "content": "Halo apa kabar?"}
    ]
  }'
```
