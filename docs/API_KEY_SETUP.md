# 🔑 Panduan Konfigurasi API Key (Authentication)

Dokumen ini menjelaskan cara mengaktifkan dan mengelola **API Key** pada server **`agy-rest`** untuk mengamankan endpoint dari akses publik yang tidak diizinkan.

---

## 1. Cara Kerja Proteksi API Key

* Jika variabel lingkungan `API_KEY` **kosong / tidak disetel**, semua endpoint terbuka untuk publik.
* Jika variabel lingkungan `API_KEY` **disetel** (misal: `API_KEY=sk-agy-rahasia-123456`):
  * Endpoint publik (bebas diakses): `GET /` dan `GET /health`
  * Endpoint yang diproteksi: `POST /v1/chat/completions`, `GET /v1/models`, `POST /api/chat`, dll.
  * Setiap request yang masuk **wajib** menyertakan API Key yang sesuai. Jika tidak, server mengembalikan status **`401 Unauthorized`**.

---

## 2. Cara Mengaktifkan API Key di Server

### Metode A: Menggunakan File `.env` (Development)

1. Buka file `.env` di folder `/srv/www/agy-rest`:
   ```bash
   nano /srv/www/agy-rest/.env
   ```

2. Tambahkan baris `API_KEY` dengan kunci rahasia Anda:
   ```env
   PORT=8060
   HOST=0.0.0.0
   AGY_PATH=/home/roby/.local/bin/agy
   API_KEY=sk-agy-rahasia-123456
   ```

3. Simpan file (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

### Metode B: Menggunakan Systemd Service (Production)

Jika Anda menjalankan server sebagai service sistem (background 24/7):

1. Edit file service:
   ```bash
   sudo nano /etc/systemd/system/agy-rest.service
   ```

2. Tambahkan baris `Environment=API_KEY=...`:
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
   Environment=API_KEY=sk-agy-rahasia-123456
   Environment=PATH=/home/roby/.nvm/versions/node/v26.13.0/bin:/home/roby/.local/bin:/usr/local/bin:/usr/bin:/bin
   ExecStart=/home/roby/.nvm/versions/node/v26.13.0/bin/node /srv/www/agy-rest/dist/index.js
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

3. Terapkan konfigurasi baru dan restart service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart agy-rest
   ```

4. Pastikan service kembali aktif:
   ```bash
   sudo systemctl status agy-rest
   ```

---

## 3. Format Pengiriman API Key pada Request

Server mendukung 3 cara pengiriman API Key:

| Tipe Header | Contoh Format | Kegunaan |
| :--- | :--- | :--- |
| **Authorization (Bearer)** | `Authorization: Bearer sk-agy-rahasia-123456` | Standar OpenAI API, Chatbox, NextChat, Python SDK |
| **x-api-key** | `x-api-key: sk-agy-rahasia-123456` | Alternatif REST API umum |
| **api-key** | `api-key: sk-agy-rahasia-123456` | Format Azure / Anthropic style |

---

## 4. Uji Coba Keamanan

Setelah API Key diaktifkan:

### A. Uji Coba Tanpa API Key (Akan Ditolak 401)
```bash
curl -i -X POST https://roby-agy.mooo.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Halo"}]}'
```
**Respons:**
```json
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized: Invalid API key"}
```

### B. Uji Coba Dengan API Key yang Benar (Berhasil 200)
```bash
curl -N -X POST https://roby-agy.mooo.com/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-rahasia-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.8-flash-high",
    "messages": [{"role": "user", "content": "Halo!"}],
    "stream": true
  }'
```
