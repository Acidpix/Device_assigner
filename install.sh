#!/usr/bin/env bash
# install.sh — Déploiement Solidays Device Assigner sur Debian 11 LXC
set -euo pipefail

APP_NAME="device-assigner"
WEB_ROOT="/var/www/${APP_NAME}"
API_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
PORT_API=3001

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (ou via sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Paquets de base ────────────────────────────────────────────────────────
echo "==> Mise à jour des paquets..."
apt-get update -qq
apt-get install -y -qq nginx curl

# ── Node.js LTS ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "==> Installation de Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -qq nodejs
fi
echo "    Node $(node -v) / npm $(npm -v)"

# ── Fichiers statiques ─────────────────────────────────────────────────────
echo "==> Copie des fichiers statiques → ${WEB_ROOT}"
mkdir -p "${WEB_ROOT}"
cp "${SCRIPT_DIR}/index.html" "${WEB_ROOT}/"
cp "${SCRIPT_DIR}/style.css"  "${WEB_ROOT}/"
cp "${SCRIPT_DIR}/app.js"     "${WEB_ROOT}/"
chown -R www-data:www-data "${WEB_ROOT}"
chmod -R 755 "${WEB_ROOT}"

# ── API Node.js ────────────────────────────────────────────────────────────
echo "==> Installation de l'API → ${API_DIR}"
mkdir -p "${API_DIR}" "${DATA_DIR}"
cp "${SCRIPT_DIR}/server.js"    "${API_DIR}/"
cp "${SCRIPT_DIR}/package.json" "${API_DIR}/"
chown -R www-data:www-data "${DATA_DIR}"
cd "${API_DIR}" && npm install --omit=dev --quiet
cd "${SCRIPT_DIR}"

# ── Service systemd ────────────────────────────────────────────────────────
echo "==> Création du service systemd ${APP_NAME}..."
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Device Assigner API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${API_DIR}
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=PORT=${PORT_API}
Environment=DATA_FILE=${DATA_DIR}/data.json

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl restart "${APP_NAME}"

# ── Configuration Nginx ────────────────────────────────────────────────────
echo "==> Écriture de la configuration Nginx..."
cat > "${NGINX_CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root ${WEB_ROOT};
    index index.html;

    gzip on;
    gzip_types text/css application/javascript text/html application/json;

    # Flux temps réel (SSE) — pas de tampon, connexion longue
    location /api/events {
        proxy_pass            http://127.0.0.1:${PORT_API};
        proxy_http_version    1.1;
        proxy_set_header      Host \$host;
        proxy_set_header      Connection '';
        proxy_buffering       off;
        proxy_cache           off;
        chunked_transfer_encoding off;
        proxy_read_timeout    3600s;
    }

    # Proxy vers l'API Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:${PORT_API};
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_read_timeout 10s;
    }

    # Cache fichiers statiques
    location ~* \.(css|js)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    access_log off;
    error_log /var/log/nginx/${APP_NAME}.error.log warn;
}
EOF

if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
fi
ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${APP_NAME}"

nginx -t
systemctl enable nginx
systemctl restart nginx

# ── Résumé ─────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "══════════════════════════════════════════════"
echo "  Installation terminée !"
echo "  Application : http://${IP}"
echo "  API         : http://${IP}/api/state"
echo "  Données     : ${DATA_DIR}/data.json"
echo "══════════════════════════════════════════════"
