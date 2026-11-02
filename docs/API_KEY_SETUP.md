# 🔑 Panduan Konfigurasi API Key (Authentication & Role Separation)

Dokumen ini menjelaskan cara mengaktifkan dan mengelola **API Key** pada server **`agy-rest`**, termasuk pemisahan hak akses antara **Antigravity CLI (Cloud)** dan **llama.cpp (Local GGUF)** untuk keamanan maksimal.

---

## 1. Pemisahan Hak Akses Kunci (Role Separation)

Untuk mencegah kebocoran kuota cloud atau membatasi pengguna tertentu hanya bisa mengakses model lokal tanpa biaya, server mendukung 3 tingkatan kunci API:

| Variabel Lingkungan | Nama Kunci | Cakupan Hak Akses | Status |
| :--- | :--- | :--- | :--- |
| `API_KEY` / `MASTER_API_KEY` | **Master Key** | Akses penuh ke semua model (**Antigravity** + **llama.cpp**) | Admin / Pengelola |
| `AGY_API_KEY` | **Antigravity Key** | Dibatasi **hanya** untuk model cloud Antigravity (`gemini-*`, `claude-*`, `gpt-oss-*`) | Pengguna Cloud |
| `LLAMA_API_KEY` | **llama.cpp Key** | Dibatasi **hanya** untuk model lokal offline (`qwen*`, `llama*`, `mistral*`, dll.) | Klien Lokal / Hemat Kuota |

### 🔒 Perilaku Keamanan (Access Enforcement):
1. **Penyaringan Model Otomatis (`GET /v1/models`)**:
   - Jika klien masuk dengan `LLAMA_API_KEY`, daftar model yang dikembalikan hanya model lokal `llama.cpp`.
   - Jika klien masuk dengan `AGY_API_KEY`, daftar model yang dikembalikan hanya model cloud `agy`.
   - Jika klien masuk dengan `API_KEY` (Master), semua model ditampilkan.
2. **Perlindungan Eksekusi (`POST /v1/chat/completions`)**:
   - Klien dengan `LLAMA_API_KEY` yang mencoba memanggil model `gemini-*` atau `claude-*` akan langsung ditolak dengan status **`403 Forbidden`**.
   - Klien dengan `AGY_API_KEY` yang mencoba memanggil model lokal akan ditolak dengan status **`403 Forbidden`**.

---

## 2. Cara Mengaktifkan API Key di Server

### Metode A: Menggunakan File `.env` (Development & Standalone)

1. Buka file `.env` di folder proyek Anda:
   ```bash
   nano .env
   ```

2. Tentukan kunci sesuai kebutuhan keamanan Anda:
   ```env
   PORT=8060
   HOST=0.0.0.0

   # Master Key (Akses ke semua model)
   API_KEY=sk-agy-roby-master-key-8060

   # Kunci khusus Antigravity (Gemini, Claude, GPT-OSS)
   AGY_API_KEY=sk-agy-cloud-token-8060

   # Kunci khusus llama.cpp (Model GGUF lokal offline)
   LLAMA_API_KEY=sk-llama-local-token-8060
   ```

3. Simpan perubahan dan restart server.

---

### Metode B: Menggunakan Systemd Service (Production)

Jika Anda menjalankan server sebagai service sistem di server remote:

1. Edit file unit systemd:
   ```bash
   sudo nano /etc/systemd/system/agy-rest.service
   ```

2. Tambahkan variabel lingkungan API key di blok `[Service]`:
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
   Environment=API_KEY=sk-agy-roby-master-key-8060
   Environment=AGY_API_KEY=sk-agy-cloud-token-8060
   Environment=LLAMA_API_KEY=sk-llama-local-token-8060
   Environment=PATH=/home/roby/.nvm/versions/node/v26.13.0/bin:/home/roby/.local/bin:/usr/local/bin:/usr/bin:/bin
   ExecStart=/home/roby/.nvm/versions/node/v26.13.0/bin/node dist/index.js
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

3. Muat ulang dan restart service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart agy-rest
   ```

---

## 3. Cara Menguji Kunci API

### 1. Uji Kunci Khusus llama.cpp:
```bash
# Permintaan model lokal berhasil
curl -s -X POST http://localhost:8060/v1/chat/completions \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3.5-0.8b", "messages": [{"role": "user", "content": "Halo!"}]}'

# Permintaan model cloud DITOLAK (403 Forbidden)
curl -s -X POST http://localhost:8060/v1/chat/completions \
  -H "Authorization: Bearer sk-llama-local-token-8060" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-3.8-flash-high", "messages": [{"role": "user", "content": "Halo!"}]}'
```

### 2. Uji Kunci Khusus Antigravity:
```bash
# Permintaan model cloud berhasil
curl -s -X POST http://localhost:8060/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-cloud-token-8060" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-3.8-flash-high", "messages": [{"role": "user", "content": "Halo!"}]}'

# Permintaan model lokal DITOLAK (403 Forbidden)
curl -s -X POST http://localhost:8060/v1/chat/completions \
  -H "Authorization: Bearer sk-agy-cloud-token-8060" \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3.5-0.8b", "messages": [{"role": "user", "content": "Halo!"}]}'
```
