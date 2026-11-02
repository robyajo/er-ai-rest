#!/usr/bin/env bash
# ==============================================================================
# er-ai-rest — VPS Production Build & Cache Cleanup Automation Script
# ==============================================================================
# Usage:
#   chmod +x finis.sh
#   ./finis.sh
#   (atau 'sudo ./finis.sh' untuk auto-migrasi unit systemd service)
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

log_info()    { echo -e "${BLUE}${BOLD}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${RESET} $1"; }
log_warn()    { echo -e "${YELLOW}${BOLD}[WARN]${RESET} $1"; }
log_error()   { echo -e "${RED}${BOLD}[ERROR]${RESET} $1"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_DIR}"

echo -e "\n${CYAN}${BOLD}======================================================${RESET}"
echo -e "${CYAN}${BOLD} 🚀 er-ai-rest VPS Build & Deployment Routine ${RESET}"
echo -e "${CYAN}${BOLD}======================================================${RESET}\n"

# 1. Environment & Dependency Check
log_info "Memeriksa lingkungan runtime dan paket manajer..."
if ! command -v node >/dev/null 2>&1; then
  log_error "Node.js tidak ditemukan! Harap pasang Node.js >= 20 terlebih dahulu."
  exit 1
fi

NODE_VERSION=$(node -v)
log_success "Node.js terpasang: ${NODE_VERSION}"

PKG_MANAGER="pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v npm >/dev/null 2>&1; then
    log_warn "pnpm tidak ditemukan di PATH, mencoba memasang pnpm via npm..."
    npm install -g pnpm || PKG_MANAGER="npm"
  else
    log_error "Tidak ada pnpm atau npm yang terpasang!"
    exit 1
  fi
fi
log_success "Menggunakan paket manajer: ${PKG_MANAGER}"

# 2. Cache & Stale Build Cleanup
log_info "Membersihkan cache pembangunan sebelumnya dan berkas usang..."

# Hapus folder dist lama
if [ -d "dist" ]; then
  rm -rf dist
  log_success "Direktori lama 'dist/' berhasil dibersihkan."
fi

# Hapus cache TypeScript & bundler
rm -rf tsconfig.tsbuildinfo node_modules/.cache .turbo .next 2>/dev/null || true
log_success "Cache kompilator internal dibersihkan."

# Bersihkan cache paket manajer bila diminta atau saat build bersih
if [ "${1:-}" == "--clean-all" ]; then
  log_info "Mode pembersihan penuh aktif: membersihkan store pnpm / npm..."
  if [ "${PKG_MANAGER}" == "pnpm" ]; then
    pnpm store prune || true
  else
    npm cache clean --force || true
  fi
  log_success "Cache dependensi paket manajer dibersihkan."
fi

# 3. Install Dependensi
log_info "Memperbarui dependensi proyek (${PKG_MANAGER})..."
if [ "${PKG_MANAGER}" == "pnpm" ]; then
  if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile || pnpm install
  else
    pnpm install
  fi
else
  npm install
fi
log_success "Seluruh dependensi berhasil disinkronkan."

# 4. Build TypeScript ke JavaScript Produksi
log_info "Mengompilasi source code TypeScript (pnpm run build)..."
if [ "${PKG_MANAGER}" == "pnpm" ]; then
  pnpm run build
else
  npm run build
fi

if [ ! -f "dist/index.js" ]; then
  log_error "Pembangunan gagal! Berkas 'dist/index.js' tidak ditemukan."
  exit 1
fi
log_success "Kompilasi TypeScript berhasil! Artefak siap di 'dist/'."

# 5. Cek & Muat Ulang Systemd Service (Jika dijalankan di VPS Linux)
SERVICE_NAME="er-ai-rest"
LEGACY_SERVICE="agy-rest"

if command -v systemctl >/dev/null 2>&1; then
  CAN_SUDO=false
  SUDO_CMD=""
  if [ "$EUID" -eq 0 ]; then
    CAN_SUDO=true
  elif sudo -n true 2>/dev/null; then
    CAN_SUDO=true
    SUDO_CMD="sudo"
  fi

  if [ "$CAN_SUDO" = true ]; then
    # Auto-migrasi ke er-ai-rest.service jika file unit belum ada di /etc/systemd/system/
    if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
      if [ -f "${PROJECT_DIR}/${SERVICE_NAME}.service" ]; then
        log_info "Memasang unit '${SERVICE_NAME}.service' ke /etc/systemd/system/..."
        $SUDO_CMD cp "${PROJECT_DIR}/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
        $SUDO_CMD chmod 644 "/etc/systemd/system/${SERVICE_NAME}.service"
      fi
    fi

    # Nonaktifkan service agy-rest lama bila er-ai-rest aktif atau sedang dimigrasikan
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
      if systemctl is-active "${LEGACY_SERVICE}" >/dev/null 2>&1 || [ -f "/etc/systemd/system/${LEGACY_SERVICE}.service" ]; then
        log_info "Mematikan dan menonaktifkan service lama '${LEGACY_SERVICE}'..."
        $SUDO_CMD systemctl stop "${LEGACY_SERVICE}" 2>/dev/null || true
        $SUDO_CMD systemctl disable "${LEGACY_SERVICE}" 2>/dev/null || true
      fi
    fi

    if systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1 || [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
      log_info "Mendeteksi systemd service '${SERVICE_NAME}', memuat ulang service..."
      $SUDO_CMD systemctl daemon-reload
      $SUDO_CMD systemctl enable "${SERVICE_NAME}"
      $SUDO_CMD systemctl restart "${SERVICE_NAME}"
      log_success "Service '${SERVICE_NAME}' berhasil di-restart!"
    fi
  else
    # Jika dijalankan tanpa passwordless sudo (misal via user roby)
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
      log_info "Mendeteksi unit service '${SERVICE_NAME}' terpasang. Memuat ulang proses..."
    else
      log_info "Service '${SERVICE_NAME}.service' siap dipasang. (Jalankan 'sudo ./finis.sh' untuk auto-migrasi unit)."
    fi
    log_info "Memuat ulang proses node runtime aktif untuk menerapkan kode baru..."
    pkill -u "$(id -un)" -f "dist/index.js" 2>/dev/null || true
  fi
else
  log_info "Bukan lingkungan systemd Linux (mis. macOS / Docker). Lewati langkah restart service."
fi

# 6. Uji Healthcheck Cepat (Jika server sudah berjalan di port 8060)
PORT="8060"
if [ -f ".env" ]; then
  CONFIG_PORT=$(grep -E "^PORT=" .env | cut -d '=' -f2 | tr -d ' "' || true)
  if [ -n "${CONFIG_PORT}" ]; then
    PORT="${CONFIG_PORT}"
  fi
fi

log_info "Menguji status endpoint kesehatan (Health Check pada port ${PORT})..."
sleep 6
if command -v curl >/dev/null 2>&1; then
  HEALTH_RES=$(curl -s "http://127.0.0.1:${PORT}/health" 2>/dev/null || true)
  if echo "${HEALTH_RES}" | grep -q '"status":"ok"'; then
    log_success "Health check BERHASIL: ${HEALTH_RES}"
  else
    log_warn "Server belum merespons di port ${PORT} atau service belum aktif. Anda dapat memulainya secara manual dengan: node dist/index.js"
  fi
fi

echo -e "\n${GREEN}${BOLD}======================================================${RESET}"
echo -e "${GREEN}${BOLD} ✨ VPS Build & Cache Cleanup Selesai dengan Sempurna! ${RESET}"
echo -e "${GREEN}${BOLD}======================================================${RESET}\n"
