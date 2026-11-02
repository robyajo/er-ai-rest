# 🧪 Er AI Rest — Testing Laboratory

Direktori `labs/` berisi utilitas dan antarmuka pengujian komprehensif untuk memverifikasi seluruh endpoint **`er-ai-rest`** (Gateway, Antigravity Cloud, Llama.cpp Local, dan Isolasi Keamanan Token).

---

## 📁 Berkas Pengujian

| Berkas | Jenis | Deskripsi |
| :--- | :--- | :--- |
| **[`labs/index.html`](./index.html)** | **Web GUI Dashboard** | Antarmuka web modern & interaktif untuk menguji semua endpoint, live streaming SSE, dan simulasi request. |
| **[`labs/test-runner.ts`](./test-runner.ts)** | **CLI Automated Suite** | Skrip otomatisasi terminal untuk menguji 14+ skenario endpoint dengan tabel laporan berwarna & metrik latensi. |
| **[`labs/serve.ts`](./serve.ts)** | **Local HTTP Server** | Server lokal ringan berbasis Hono untuk menyajikan Web GUI di port `8061`. |

---

## 🚀 Cara Menjalankan Pengujian

### 1. Menjalankan Server Utama Terlebih Dahulu
Pastikan server `er-ai-rest` sedang berjalan di terminal lain:
```bash
pnpm dev
# Server aktif di http://localhost:8060
```

---

### 2. Menggunakan CLI Test Runner Otomatis
Jalankan perintah pengujian terminal sekali jalan:
```bash
# Menjalankan seluruh pengujian endpoint otomatis
pnpm tsx labs/test-runner.ts

# Atau lewat skrip package.json:
pnpm run test:endpoints
```

**Skenario yang diuji secara otomatis:**
* `GET /` — Banner dan direktori rute publik (200 OK)
* `GET /health` — Pemeriksaan status kesehatan server (200 OK)
* `GET /v1/models` — Penolakan akses tanpa token (401 Unauthorized)
* `GET /v1/models` — Pengambilan model dinamis kompatibel OpenAI via Master Key (200 OK)
* `GET /api/models` — Rekapitulasi breakdown model cloud & lokal (200 OK)
* `GET /agy/models` & `GET /agy/v1/models` — Endpoint model Antigravity (200 OK)
* `GET /llama/status` — Status mesin lokal llama.cpp (200 OK)
* `GET /llama/models` & `GET /llama/v1/models` — Pemindaian model GGUF lokal (200 OK)
* **Isolasi Peran (Role Access Isolation):**
  * Verifikasi `AGY_API_KEY` berhasil pada `/agy/*` (200 OK)
  * Verifikasi `AGY_API_KEY` **DITOLAK** pada `/llama/*` (403 Forbidden)
  * Verifikasi `LLAMA_API_KEY` berhasil pada `/llama/*` (200 OK)
  * Verifikasi `LLAMA_API_KEY` **DITOLAK** pada `/agy/*` (403 Forbidden)

---

### 3. Menggunakan Web GUI Testing Laboratory
Tersedia dua cara membuka antarmuka visual:

#### Opsi A: Menggunakan Server Lokal Ringan
```bash
pnpm tsx labs/serve.ts
# Buka di peramban: http://localhost:8061
```

#### Opsi B: Membuka Berkas Langsung di Browser
Buka berkas `labs/index.html` langsung di browser Chrome / Firefox / Safari (CORS sudah aktif secara global di server):
```bash
open labs/index.html
```

**Fitur Web Testing Dashboard:**
* **Live Ping**: Pemantauan status online server dan latensi waktu-nyata.
* **One-Click Automated Suite**: Menguji seluruh rute dan menampilkan tabel hasil PASS/FAIL berserta durasi milidetik.
* **Interactive Playground**:
  * Penguji request GET & POST dengan template JSON bawaan.
  * Pemilih token otentikasi cepat (Master Key, AGY Key, Llama Key, atau No Auth).
  * **Real-time SSE Streaming Viewer**: Membaca transmisi teks langsung Server-Sent Events huruf per huruf beserta penghitung karakter.
* **Security Matrix**: Visualisasi tabel izin akses antar token terhadap modul rute.
