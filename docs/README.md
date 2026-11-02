# 📑 Dokumentasi Resmi `er-ai-rest`

Selamat datang di pusat dokumentasi **`er-ai-rest`** — Gateway REST & OpenAI-Compatible multi-engine untuk **Google Antigravity CLI (`agy`)** dan **llama.cpp (Local GGUF models)**.

---

## 🗂️ Navigasi Modul & Panduan

### 1. Modul Mesin AI (Modular Architecture)
- **[☁️ Antigravity (agy) Guide (`/agy/*`)](./agy/README.md)**
  Panduan lengkap endpoint cloud berkecepatan tinggi dengan model Gemini 3.8 Flash, Claude Sonnet 4.6, dan GPT-OSS 120B serta kontrol parameter penalaran (*reasoning effort*).
- **[🦙 llama.cpp Guide (`/llama/*`)](./llama/README.md)**
  Panduan lengkap endpoint model lokal mandiri (offline) berkecepatan tinggi (~300ms) dengan biner llama.cpp, direct streaming, pelengkap teks OpenAI (`/completions`), dan kontrol mode berpikir.

---

### 2. Autentikasi & Keamanan Kunci
- **[🔑 Panduan Konfigurasi API Key & Role Separation](./API_KEY_SETUP.md)**
  Panduan mengaktifkan token akses dan pemisahan kunci antara `API_KEY` (Master), `AGY_API_KEY` (Khusus cloud), dan `LLAMA_API_KEY` (Khusus model lokal).

---

### 3. Integrasi Klien Eksternal
- **[📱 Panduan Integrasi Klien (Python, Node.js, Chatbox, Cursor, Continue.dev)](./CLIENT_INTEGRATION.md)**
  Contoh kode lengkap dan konfigurasi aplikasi klien OpenAI-compatible, panduan migrasi dari `roby-llama.mooo.com`, serta integrasi *code completion*.

---

## 🌐 Host & Domain Layanan Produksi

| Lingkungan | Base URL Gateway Universal | Prefix Antigravity | Prefix llama.cpp |
| :--- | :--- | :--- | :--- |
| **Produksi (VPS)** | `https://er-ai-api.mooo.com/v1` | `https://er-ai-api.mooo.com/agy/v1` | `https://er-ai-api.mooo.com/llama/v1` |
| **Lokal (Dev)** | `http://localhost:8060/v1` | `http://localhost:8060/agy/v1` | `http://localhost:8060/llama/v1` |

---

## 🌐 Ikhtisar Rute & Endpoint Lengkap

| Kategori | Method | Endpoint | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Sistem** | `GET` | `/` | Banner status gerbang, versi, dan direktori rute |
| **Sistem** | `GET` | `/health` | Pemeriksaan kesehatan berkala mesin agy & llama.cpp |
| **Unified** | `GET` | `/models` & `/v1/models` | Daftar model gabungan OpenAI-compatible |
| **Unified** | `GET` | `/api/models` | Rincian breakdown model dinamis live |
| **Unified** | `POST` | `/v1/chat/completions` | Percakapan OpenAI-compatible (Auto-routing cloud/lokal) |
| **Unified** | `POST` | `/v1/completions` | Pelengkap teks OpenAI-compatible (Universal) |
| **Antigravity** | `GET` | `/agy/v1/models` | Daftar model live Antigravity |
| **Antigravity** | `POST` | `/agy/v1/chat/completions` | Obrolan OpenAI-compatible khusus Antigravity cloud |
| **Antigravity** | `POST` | `/agy/api/chat` | Native session chat dengan `conversation_id` & `effort` |
| **Llama.cpp** | `GET` | `/llama/v1/models` | Daftar model server & lokal GGUF |
| **Llama.cpp** | `POST` | `/llama/v1/chat/completions` | Obrolan OpenAI-compatible khusus Llama (Sub-detik direct stream) |
| **Llama.cpp** | `POST` | `/llama/v1/completions` | Pelengkap teks OpenAI-compatible khusus Llama |
| **Llama.cpp** | `POST` | `/llama/completion` | Endpoint komplesi native biner llama.cpp |
| **Llama.cpp** | `GET` | `/llama/props` & `/llama/slots` | Parameter server dan diagnosa pemakaian slot/cache |
