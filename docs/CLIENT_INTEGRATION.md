# 📱 Panduan Integrasi Klien Menggunakan API Key

Server **`agy-rest`** menyediakan endpoint yang 100% kompatibel dengan **OpenAI Chat Completions API**. Ini memungkinkan Anda mengintegrasikannya ke berbagai aplikasi AI populer atau kode kustom Anda cukup dengan memasukkan **Base URL** dan **API Key**.

---

## 🌐 Informasi Parameter Sambungan

* **Base URL:** `https://roby-agy.mooo.com/v1`
* **API Key:** `<API_KEY_ANDA>` (yang disetel di `.env` / systemd)
* **Default Model:** `gemini-3.8-flash-high`
* **Pilihan Model Lainnya:**
  * `gemini-3.8-flash-high`
  * `gemini-3.8-flash-medium`
  * `gemini-3.8-flash-low`
  * `claude-sonnet-4-6`
  * `claude-opus-4-6-thinking`
  * `gpt-oss-120b-medium`

---

## 1. Integrasi ke Aplikasi AI Chat

### A. NextChat (ChatGPT-Next-Web)
1. Buka aplikasi / website **NextChat**.
2. Masuk ke **Settings (Pengaturan)**.
3. Di bagian **Model Provider**, pilih **OpenAI**.
4. Isi konfigurasi:
   * **API Key:** `sk-agy-rahasia-123456`
   * **OpenAI Endpoint / Proxy:** `https://roby-agy.mooo.com` (atau dengan `/v1`)
5. Di bagian **Custom Models**, tambahkan: `gemini-3.8-flash-high,claude-sonnet-4-6`.

---

### B. Chatbox App (Desktop & Mobile)
1. Buka aplikasi **Chatbox**.
2. Masuk ke menu **Settings** $\rightarrow$ **Model Provider**.
3. Pilih **OpenAI API**.
4. Masukkan parameter:
   * **API Host:** `https://roby-agy.mooo.com`
   * **API Key:** `sk-agy-rahasia-123456`
   * **Model:** `gemini-3.8-flash-high`
5. Klik **Save** dan Anda sudah bisa mengobrol!

---

### C. Open WebUI / LibreChat
1. Masuk ke halaman **Admin Panel** $\rightarrow$ **Settings** $\rightarrow$ **Connections**.
2. Tambahkan sambungan OpenAI baru:
   * **Base URL:** `https://roby-agy.mooo.com/v1`
   * **API Key:** `sk-agy-rahasia-123456`
3. Klik tombol **Verify Connection**.

---

## 2. Integrasi Menggunakan Kode Pemrograman

### A. Python (Official OpenAI SDK)

Pastikan paket `openai` terpasang (`pip install openai`):

```python
from openai import OpenAI

# Inisialisasi klien dengan Base URL dan API Key server Anda
client = OpenAI(
    base_url="https://roby-agy.mooo.com/v1",
    api_key="sk-agy-rahasia-123456"
)

# 1. Panggilan dengan Streaming (Real-Time)
response = client.chat.completions.create(
    model="gemini-3.8-flash-high",
    messages=[
        {"role": "system", "content": "Anda adalah asisten AI yang cerdas."},
        {"role": "user", "content": "Tuliskan 3 tips produktivitas koding!"}
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
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://roby-agy.mooo.com/v1',
  apiKey: 'sk-agy-rahasia-123456',
});

async function main() {
  const stream = await client.chat.completions.create({
    model: 'gemini-3.8-flash-high',
    messages: [
      { role: 'user', content: 'Jelaskan perbedaan synchronous dan asynchronous!' }
    ],
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

### C. cURL (Terminal / Bash)

#### Streaming Request (Gunakan flag `-N`):
```bash
curl -N -X POST https://roby-agy.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-rahasia-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [
      {"role": "user", "content": "Sebutkan 3 distro Linux terpopuler!"}
    ],
    "stream": true
  }'
```

#### Non-Streaming Request (JSON Lengkap):
```bash
curl -X POST https://roby-agy.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-rahasia-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [
      {"role": "user", "content": "Halo apa kabar?"}
    ]
  }'
```
