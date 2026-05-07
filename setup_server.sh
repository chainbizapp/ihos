#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# IHOS One-Time Server Setup
# Run this ONCE on the server as root:
#   bash setup_server.sh
# ─────────────────────────────────────────────────────────────────────────────

REMOTE_USER="sftpihos"
APP_DIR="/opt/ihos/api"
WEB_DIR="/var/www/ihos"
SERVICE_NAME="ihos-api"
API_PORT="5111"
DOMAIN="ihos.bizworka.cloud"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[SETUP]${NC} $*"; }
ok()  { echo -e "${GREEN}[  OK ]${NC} $*"; }
die() { echo -e "${RED}[ FAIL]${NC} $*" >&2; exit 1; }

[ "$EUID" -eq 0 ] || die "Run this script as root: sudo bash setup_server.sh"

# ── Create deploy user ────────────────────────────────────────────────────────
log "Ensuring deploy user '$REMOTE_USER' exists..."
if ! id "$REMOTE_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$REMOTE_USER"
  read -rsp "Set password for deploy user '${REMOTE_USER}': " _DEPLOY_PASS
  echo ""
  echo "${REMOTE_USER}:${_DEPLOY_PASS}" | chpasswd
  unset _DEPLOY_PASS
  ok "User '$REMOTE_USER' created."
else
  ok "User '$REMOTE_USER' already exists."
fi

# Prepare .ssh dir so key-based auth can be installed by the deploy script
SSH_DIR="/home/$REMOTE_USER/.ssh"
mkdir -p "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
chmod 700 "$SSH_DIR"
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$REMOTE_USER:$REMOTE_USER" "$SSH_DIR"
ok "SSH directory ready for $REMOTE_USER."

# Allow password authentication for this user so ssh-copy-id can work
# (Ubuntu 24 disables it globally by default)
if ! grep -q "Match User $REMOTE_USER" /etc/ssh/sshd_config; then
  cat >> /etc/ssh/sshd_config <<EOF

# Allow password auth for the IHOS deploy user (needed for initial key install)
Match User $REMOTE_USER
    PasswordAuthentication yes
EOF
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  ok "Password auth enabled for $REMOTE_USER in sshd_config."
fi

# ── Install .NET 10 runtime ───────────────────────────────────────────────────
log "Checking .NET 10 runtime..."
if ! dotnet --list-runtimes 2>/dev/null | grep -q 'Microsoft.AspNetCore.App 10'; then
  log "Installing .NET 10 runtime..."
  wget -q https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb \
       -O /tmp/packages-microsoft-prod.deb
  dpkg -i /tmp/packages-microsoft-prod.deb
  apt-get update -qq
  apt-get install -y aspnetcore-runtime-10.0
fi
ok ".NET 10 runtime ready."

# ── Install Nginx ─────────────────────────────────────────────────────────────
log "Checking Nginx..."
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
fi
ok "Nginx ready."

# ── Install inotify-tools (for deploy watcher) ────────────────────────────────
log "Checking inotify-tools..."
if ! command -v inotifywait &>/dev/null; then
  apt-get install -y inotify-tools
fi
ok "inotify-tools ready."

# ── Create directories ────────────────────────────────────────────────────────
log "Creating directories..."
mkdir -p "$APP_DIR" "$WEB_DIR"
chown -R "$REMOTE_USER":"$REMOTE_USER" "$APP_DIR"
chown -R "$REMOTE_USER":www-data "$WEB_DIR"
chmod -R 755 "$WEB_DIR"
ok "Directories ready: $APP_DIR  $WEB_DIR"

# ── appsettings.Production.json template ─────────────────────────────────────
if [ ! -f "$APP_DIR/appsettings.Production.json" ]; then
  log "Writing appsettings.Production.json template..."
  cat > "$APP_DIR/appsettings.Production.json" <<'JSON'
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=ihos_prod;Username=ihos;Password=CHANGE_ME"
  },
  "Jwt": {
    "SecretKey": "CHANGE_ME_TO_A_64_CHAR_OR_LONGER_SECRET_KEY_FOR_PRODUCTION!!",
    "AccessTokenExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 7
  },
  "JasperReports": {
    "BaseUrl": "http://localhost:7030/"
  },
  "Smtp": {
    "Host": "localhost",
    "Port": 25,
    "From": "noreply@ihos.local",
    "EnableSsl": false
  },
  "AllowedOrigins": "http://ihos.bizworka.cloud",
  "Serilog": {
    "MinimumLevel": {
      "Default": "Warning",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    }
  }
}
JSON
  chown "$REMOTE_USER":"$REMOTE_USER" "$APP_DIR/appsettings.Production.json"
  echo ""
  echo -e "${RED}>>> IMPORTANT: Edit $APP_DIR/appsettings.Production.json before starting the API! <<<${NC}"
  echo ""
fi

# ── Nginx site config ─────────────────────────────────────────────────────────
log "Writing Nginx config..."
cat > /etc/nginx/sites-available/ihos <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    root $WEB_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        keep-alive;
        proxy_read_timeout 120s;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               application/wasm;
    gzip_min_length 1024;
}
NGINX

ln -sf /etc/nginx/sites-available/ihos /etc/nginx/sites-enabled/ihos
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx
ok "Nginx configured for $DOMAIN"

# ── systemd API service ───────────────────────────────────────────────────────
log "Writing systemd service: $SERVICE_NAME..."
cat > /etc/systemd/system/${SERVICE_NAME}.service <<SERVICE
[Unit]
Description=IHOS Insurance API (.NET 10)
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/dotnet $APP_DIR/Ihos.API.dll
Restart=always
RestartSec=5
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://127.0.0.1:$API_PORT
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ihos-api

[Install]
WantedBy=multi-user.target
SERVICE

# ── systemd deploy-watcher service (auto-restart on new upload) ───────────────
log "Writing deploy watcher service..."
cat > /etc/systemd/system/ihos-deploy-watcher.service <<WATCHER
[Unit]
Description=IHOS Deploy Watcher — restarts API when new files are uploaded
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/inotifywait -m -e close_write,moved_to $APP_DIR \
  --include '.*\\.dll\$' \
  --format '%f'
ExecStartPost=/bin/bash -c 'systemctl restart $SERVICE_NAME'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
WATCHER

# Simpler watcher using a trigger file approach
cat > /usr/local/bin/ihos-deploy-watch.sh <<'WATCH'
#!/bin/bash
TRIGGER="/opt/ihos/api/.deploy_trigger"
API_SERVICE="ihos-api"

echo "[watcher] Watching for deploy trigger at $TRIGGER"
while true; do
  inotifywait -q -e close_write,moved_to "$(dirname "$TRIGGER")" \
    --include "$(basename "$TRIGGER")" 2>/dev/null
  echo "[watcher] Deploy trigger detected — restarting $API_SERVICE"
  systemctl restart "$API_SERVICE"
  echo "[watcher] $API_SERVICE restarted."
done
WATCH
chmod +x /usr/local/bin/ihos-deploy-watch.sh

cat > /etc/systemd/system/ihos-deploy-watcher.service <<WATCHER
[Unit]
Description=IHOS Deploy Watcher
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/ihos-deploy-watch.sh
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
WATCHER

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl enable ihos-deploy-watcher
systemctl start ihos-deploy-watcher
ok "Deploy watcher running."

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Server setup complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo "  1. Edit $APP_DIR/appsettings.Production.json with real DB/JWT values"
echo "  2. Run ./start_deploy.sh from your Mac to deploy the app"
echo ""
echo "  Useful commands:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME -f"
echo "    systemctl status ihos-deploy-watcher"
echo ""
