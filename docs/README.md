# 📚 Dokumentasi agy-rest

Selamat datang di dokumentasi resmi **agy-rest** — Gateway REST & OpenAI API untuk Google Antigravity CLI.

---

## 📑 Daftar Isi Dokumentasi

1. **[🔑 Panduan Konfigurasi API Key](./API_KEY_SETUP.md)**
   * Cara kerja autentikasi API Key.
   * Cara mengaktifkan API Key di file `.env` atau systemd service.
   * Format header yang didukung (`Authorization: Bearer`, `x-api-key`, `api-key`).
   * Cara menguji proteksi endpoint.

2. **[📱 Panduan Integrasi Klien](./CLIENT_INTEGRATION.md)**
   * Menghubungkan aplikasi Chatbot GUI (Chatbox, NextChat, Open WebUI, LibreChat).
   * Contoh kode Python menggunakan library resmi `openai`.
   * Contoh kode TypeScript / Node.js.
   * Panduan cURL di Linux terminal.

3. **[⚙️ Konfigurasi Produksi & Nginx](../README.md)**
   * Pengaturan systemd service agar aktif 24/7.
   * Konfigurasi Nginx reverse proxy + SSL Let's Encrypt.
   * Penanganan port 8060.
