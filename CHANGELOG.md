# 📝 Catatan Perubahan (Changelog) — `agy-rest`

Semua perubahan penting pada proyek **`agy-rest`** didokumentasikan dalam berkas ini. Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/lang/id/).

---

## [1.4.0] — 2026-11-02

### 🚀 Ditambahkan (Added)
- **Pencarian Model Dinamis Waktu-Nyata (`Dynamic Model Discovery`)**:
  - `GET /api/models`: Rekapitulasi status seluruh model aktif, sumber deteksi, dan pengelompokan per engine.
  - Deteksi model live Antigravity langsung dari perintah CLI `agy models`.
  - Pemindaian berkas model lokal `.gguf` secara otomatis pada disk komputer (`~/.cache/huggingface/hub/`, `~/models`, `~/.llama-app/models`).
- **Skrip Otomatisasi Deploy VPS & Pembersihan Cache (`finis.sh`)**:
  - Menghapus folder `dist/` lama, cache kompilasi TypeScript (`tsconfig.tsbuildinfo`), dan `node_modules/.cache`.
  - Menginstal dependensi terverifikasi via `pnpm install --frozen-lockfile`.
  - Kompilasi TypeScript ke JavaScript siap produksi.
  - Otomatis me-restart systemd service `agy-rest` di lingkungan VPS Linux.
  - Menjalankan uji kesehatan mandiri (`curl /health`).
- **Dokumentasi Terpisah per Modul**:
  - `docs/agy/README.md`: Panduan khusus integrasi dan pemakaian model Antigravity.
  - `docs/llama/README.md`: Panduan khusus integrasi dan pemakaian model lokal llama.cpp.
  - `docs/README.md`: Indeks master navigasi dokumentasi.

### 🔄 Diubah & Ditingkatkan (Changed)
- **Refactoring Arsitektur Rute Modular (`src/routes/`)**:
  - Seluruh logika rute dipindahkan ke dalam folder `src/routes/` (`agy.ts`, `llamacpp.ts`, `gateway.ts`, `index.ts`).
  - Berkas `src/index.ts` dirampingkan murni sebagai inisialisasi server, middleware CORS, dan pemasangan router.

---

## [1.3.0] — 2026-11-02

### 🚀 Ditambahkan (Added)
- **Prefiks Rute Modular Mandiri**:
  - Prefiks `/agy/*` untuk akses khusus Antigravity (`/agy/v1/chat/completions`, `/agy/v1/models`, `/agy/api/chat`).
  - Prefiks `/llama/*` untuk akses khusus llama.cpp (`/llama/v1/chat/completions`, `/llama/v1/models`, `/llama/status`).
  - Rute gerbang cerdas terpadu di `/v1/*` tetap dipertahankan untuk kompatibilitas klien OpenAI.

---

## [1.2.0] — 2026-11-02

### 🛡️ Keamanan (Security)
- **Pemisahan Kunci API & Hak Akses (Role Separation)**:
  - `API_KEY` (Master Key): Akses penuh ke semua engine dan model.
  - `AGY_API_KEY`: Dibatasi secara ketat hanya untuk model cloud Antigravity.
  - `LLAMA_API_KEY`: Dibatasi secara ketat hanya untuk model lokal offline llama.cpp.
  - Perlindungan otomatis dengan status `403 Forbidden` jika kunci lokal mencoba mengakses kuota model cloud (atau sebaliknya).
  - Penyaringan daftar model dinamis sesuai hak akses token klien.

---

## [1.1.0] — 2026-11-02

### 🚀 Ditambahkan (Added)
- **Dukungan Engine llama.cpp (Model Lokal GGUF)**:
  - Integrasi model lokal mandiri tanpa ketergantungan internet.
  - Dual-mode otomatis: mendeteksi server HTTP `llama serve` atau menjalankan biner CLI `llama completion` secara mandiri.
  - Streaming respons real-time (SSE) untuk model lokal.
  - Kompatibel dengan model Qwen 3.5, Llama 3.2, Mistral, dan DeepSeek R1 GGUF.

---

## [1.0.0] — 2026-11-02

### 🚀 Rilis Perdana (Initial Release)
- Gerbang REST API dan OpenAI-compatible untuk **Google Antigravity CLI (`agy`)**.
- Endpoint kompatibel `/v1/chat/completions` dan `/v1/models`.
- Streaming teks waktu-nyata berbasis Server-Sent Events (SSE).
- Dukungan model penalaran Gemini 3.8 Flash, Claude Sonnet 4.6, dan GPT-OSS 120B.
- Pelanjutan riwayat sesi percakapan berkelanjutan via `conversation_id`.
- Autentikasi token akses mandiri via Bearer Header.
