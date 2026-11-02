# 📑 Dokumentasi Resmi `agy-rest`

Selamat datang di pusat dokumentasi **`agy-rest`** — Gateway REST & OpenAI-Compatible multi-engine untuk **Google Antigravity CLI (`agy`)** dan **llama.cpp (Local GGUF models)**.

---

## 🗂️ Navigasi Modul & Panduan

### 1. Modul Mesin AI (Modular Architecture)
- **[☁️ Antigravity (agy) Guide (`/agy/*`)](./agy/README.md)**
  Panduan lengkap endpoint cloud berkecepatan tinggi dengan model Gemini 3.8 Flash, Claude Sonnet 4.6, dan GPT-OSS 120B.
- **[🦙 llama.cpp Guide (`/llama/*`)](./llama/README.md)**
  Panduan lengkap endpoint model lokal mandiri (offline) berbasis GGUF dengan biner llama.cpp dan dual mode (server HTTP & CLI fallback).

---

### 2. Autentikasi & Keamanan Kunci
- **[🔑 Panduan Konfigurasi API Key & Role Separation](./API_KEY_SETUP.md)**
  Panduan mengaktifkan token akses dan pemisahan kunci antara `API_KEY` (Master), `AGY_API_KEY` (Khusus cloud), dan `LLAMA_API_KEY` (Khusus model lokal).

---

### 3. Integrasi Klien Eksternal
- **[📱 Panduan Integrasi Klien (Python, Node.js, Chatbox, NextChat)](./CLIENT_INTEGRATION.md)**
  Contoh kode lengkap dan konfigurasi aplikasi klien OpenAI-compatible untuk menghubungkan gateway ke perangkat kerja Anda.

---

## 🌐 Host & Domain Layanan Produksi

| Lingkungan | Base URL Gateway | Prefix Antigravity | Prefix llama.cpp |
| :--- | :--- | :--- | :--- |
| **Produksi (VPS)** | `https://er-ai-api.mooo.com/v1` | `https://er-ai-api.mooo.com/agy/v1` | `https://er-ai-api.mooo.com/llama/v1` |
| **Lokal (Dev)** | `http://localhost:8060/v1` | `http://localhost:8060/agy/v1` | `http://localhost:8060/llama/v1` |

---

## 🌐 Ikhtisar Rute & Prefix URL

| Kategori | Prefix Route | Deskripsi |
| :--- | :--- | :--- |
| **Antigravity Dedicated** | `/agy/v1/chat/completions`<br>`/agy/v1/models` | Rute khusus model cloud Antigravity |
| **llama.cpp Dedicated** | `/llama/v1/chat/completions`<br>`/llama/v1/models` | Rute khusus model lokal GGUF offline |
| **Unified Gateway** | `/v1/chat/completions`<br>`/v1/models` | Rute pintar otomatis yang mengarahkan kueri ke cloud atau lokal berdasarkan nama model |
