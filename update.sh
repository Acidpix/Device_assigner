#!/usr/bin/env bash
# update.sh — Met à jour l'app depuis GitHub
set -euo pipefail

REPO_URL="https://github.com/Acidpix/Device_assigner.git"
REPO_DIR="/opt/device-assigner"
WEB_ROOT="/var/www/device-assigner"

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (ou via sudo)." >&2
  exit 1
fi

# Installer git si absent
if ! command -v git &>/dev/null; then
  echo "==> Installation de git..."
  apt-get install -y -qq git
fi

# Clone initial ou pull
if [[ -d "${REPO_DIR}/.git" ]]; then
  echo "==> Pull depuis GitHub..."
  git -C "${REPO_DIR}" pull --ff-only
else
  echo "==> Clone initial depuis GitHub..."
  git clone "${REPO_URL}" "${REPO_DIR}"
fi

# Déploiement vers le web root
echo "==> Déploiement des fichiers..."
cp "${REPO_DIR}/index.html" "${WEB_ROOT}/"
cp "${REPO_DIR}/style.css"  "${WEB_ROOT}/"
cp "${REPO_DIR}/app.js"     "${WEB_ROOT}/"
chown www-data:www-data "${WEB_ROOT}"/{index.html,style.css,app.js}

echo ""
echo "══════════════════════════════════════════════"
COMMIT=$(git -C "${REPO_DIR}" log -1 --format="%h — %s")
echo "  Déployé : ${COMMIT}"
echo "══════════════════════════════════════════════"
