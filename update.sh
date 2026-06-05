#!/usr/bin/env bash
# update.sh — Met à jour l'app depuis GitHub et redémarre l'API
set -euo pipefail

REPO_URL="https://github.com/Acidpix/Device_assigner.git"
REPO_DIR="/opt/device-assigner-repo"
WEB_ROOT="/var/www/device-assigner"
API_DIR="/opt/device-assigner"
APP_NAME="device-assigner"

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (ou via sudo)." >&2
  exit 1
fi

# ── Git pull ───────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  apt-get install -y -qq git
fi

if [[ -d "${REPO_DIR}/.git" ]]; then
  echo "==> Pull depuis GitHub..."
  git -C "${REPO_DIR}" pull --ff-only
else
  echo "==> Clone initial depuis GitHub..."
  git clone "${REPO_URL}" "${REPO_DIR}"
fi

# ── Fichiers statiques ─────────────────────────────────────────────────────
echo "==> Déploiement des fichiers statiques..."
cp "${REPO_DIR}/index.html" "${WEB_ROOT}/"
cp "${REPO_DIR}/style.css"  "${WEB_ROOT}/"
cp "${REPO_DIR}/app.js"     "${WEB_ROOT}/"
chown www-data:www-data "${WEB_ROOT}"/{index.html,style.css,app.js}

# ── API ────────────────────────────────────────────────────────────────────
echo "==> Mise à jour de l'API..."
cp "${REPO_DIR}/server.js"    "${API_DIR}/"
cp "${REPO_DIR}/package.json" "${API_DIR}/"
cd "${API_DIR}" && npm install --omit=dev --quiet
cd /

echo "==> Redémarrage du service ${APP_NAME}..."
systemctl restart "${APP_NAME}"

# ── Résumé ─────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
COMMIT=$(git -C "${REPO_DIR}" log -1 --format="%h — %s")
echo "  Déployé : ${COMMIT}"
systemctl is-active --quiet "${APP_NAME}" && echo "  API     : active ✓" || echo "  API     : ERREUR ✗"
echo "══════════════════════════════════════════════"
