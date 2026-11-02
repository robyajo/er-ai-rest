# Panduan & Konvensi AI Agent — Er AI Rest

## Activity Sync — lapor kegiatan ke portfolio

Setiap selesai mengerjakan perubahan yang **dirasakan pengguna** (fitur baru, perbaikan bug, perubahan perilaku, rilis, deploy, hapus fitur), AI WAJIB mencatat di berkas rilis lalu mengirim satu entri kegiatan ke portfolio sebelum menyelesaikan tugas. Refactor internal, format, komentar, dan tes yang tak terlihat pengguna: jangan kirim.

1. Tulis/perbarui berkas rilis `releases/YYYY-MM-DD-*.json` memakai skill `release-notes` (folder `release-notes/` dalam paket activity-sync): konsolidasi 1 berkas JSON per hari, dwibahasa (id + en), bahasa pelayanan publik — bebas istilah teknis/library/framework.
2. Muat skill `activity-sync` (`.agents/skills/activity-sync/SKILL.md`) dan ikuti alur CRUD di sana: cek proyek (`GET /api/projects?key=`), kirim isi berkas rilis `releases/*.json` apa adanya lewat `POST` (tambah `"project": {"name": "Er AI Rest"}`; API yang memetakan `type`/`date`/`items` otomatis), ubah (`PATCH`), hapus (`DELETE`), lalu verifikasi (`GET` + cek tidak dobel).
3. Kunci `X-project` proyek ini: baca dari berkas `.ACTIVITY_PROJECT_KEYS` di folder skill ini — JANGAN commit berkas kunci ke git, JANGAN tampilkan ke user kecuali diminta.
4. Setiap kiriman wajib dwibahasa (`id` + `en`), maksimal 300 karakter judul / 2000 karakter isi, bahasa pelayanan publik (dilarang menyebut library, framework, database, file kode, atau mekanisme internal).
5. Laporkan ke user: apa yang dikirim (id baris), hasil verifikasi, dan apa pun yang gagal.
