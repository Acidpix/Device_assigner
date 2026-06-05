#!/usr/bin/env bash
# install.sh — Déploiement Solidays Device Assigner sur Debian 11 LXC
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────
APP_NAME="device-assigner"
WEB_ROOT="/var/www/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
PORT=80   # changer ici si un autre port est souhaité

# ── Vérifications ──────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (ou via sudo)." >&2
  exit 1
fi

echo "==> Mise à jour des paquets..."
apt-get update -qq
apt-get install -y -qq nginx

# ── Dossier web ────────────────────────────────────────────────────────────
echo "==> Création du répertoire web : ${WEB_ROOT}"
mkdir -p "${WEB_ROOT}"

echo "==> Copie des fichiers de l'application..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/index.html" "${WEB_ROOT}/"
cp "${SCRIPT_DIR}/style.css"  "${WEB_ROOT}/"
cp "${SCRIPT_DIR}/app.js"     "${WEB_ROOT}/"

chown -R www-data:www-data "${WEB_ROOT}"
chmod -R 755 "${WEB_ROOT}"

# ── Config Nginx ───────────────────────────────────────────────────────────
echo "==> Écriture de la configuration Nginx..."
cat > "${NGINX_CONF}" <<EOF
server {
    listen ${PORT};
    listen [::]:${PORT};

    server_name _;

    root ${WEB_ROOT};
    index index.html;

    # Compression gzip
    gzip on;
    gzip_types text/css application/javascript text/html;

    # Cache statique — 1 jour (localStorage gère l'état, pas de backend)
    location ~* \.(css|js)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Pas de log d'accès pour alléger l'I/O du LXC
    access_log off;
    error_log /var/log/nginx/${APP_NAME}.error.log warn;
}
EOF

# Désactiver le site par défaut si présent
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
fi

# Activer notre site
ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${APP_NAME}"

nginx -t
systemctl enable nginx
systemctl restart nginx

# ── Résumé ─────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "══════════════════════════════════════════════"
echo "  Installation terminée !"
echo "  Application disponible sur :"
echo "    http://${IP}:${PORT}"
echo "══════════════════════════════════════════════"
