#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# IHOS Production Deployment Script
# Target : ihos.bizworka.cloud → 76.13.184.228  (Ubuntu 24, Nginx)
#
# Prerequisites: run setup_server.sh on the server ONCE as root first.
# ─────────────────────────────────────────────────────────────────────────────

REMOTE_HOST="76.13.184.228"
DOMAIN="ihos.bizworka.cloud"
REMOTE_USER="sftpihos"
REMOTE_PASS=""  # Prompted only if SSH key auth is not yet set up

APP_DIR="/opt/ihos/api"
WEB_DIR="/var/www/ihos"
SERVICE_NAME="ihos-api"
SSH_KEY="$HOME/.ssh/ihos_deploy_ed25519"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.deploy_build"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
die()  { echo -e "${RED}[ FAIL ]${NC} $*" >&2; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
check_deps() {
  log "Checking local prerequisites..."
  for cmd in dotnet node npm ssh expect; do
    command -v "$cmd" &>/dev/null || die "'$cmd' is not installed."
  done
  dotnet --version | grep -q "^10\." || warn "Expected .NET 10 — found $(dotnet --version)"
  ok "All prerequisites found."
}

# ── SSH key auth (one-time, uses expect + password) ───────────────────────────
setup_ssh_auth() {
  if [ ! -f "$SSH_KEY" ]; then
    log "Generating SSH deploy key..."
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -q
    ok "SSH key generated."
  fi

  # Test if key auth already works for SFTP
  if sftp -i "$SSH_KEY" \
          -o StrictHostKeyChecking=no \
          -o ConnectTimeout=5 \
          -o BatchMode=yes \
          -b /dev/null \
          "$REMOTE_USER@$REMOTE_HOST" &>/dev/null; then
    ok "SSH key auth already configured."
    return 0
  fi

  log "Installing SSH key on server (one-time password required)..."
  read -rsp "Enter password for ${REMOTE_USER}@${REMOTE_HOST}: " REMOTE_PASS
  echo ""

  # Prefer sshpass if available (cleaner than expect)
  if command -v sshpass &>/dev/null; then
    sshpass -p "$REMOTE_PASS" ssh-copy-id \
      -i "${SSH_KEY}.pub" \
      -o StrictHostKeyChecking=no \
      -o ConnectTimeout=15 \
      "$REMOTE_USER@$REMOTE_HOST" \
    || die "ssh-copy-id failed. Ensure setup_server.sh was run on the server first."
  else
    expect -c "
      set timeout 30
      spawn ssh-copy-id -i ${SSH_KEY}.pub \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=15 \
        ${REMOTE_USER}@${REMOTE_HOST}
      expect {
        -re {[Pp]assword:} { send \"${REMOTE_PASS}\r\"; exp_continue }
        -re {denied}       { exit 1 }
        eof
      }
    " || die "ssh-copy-id failed. Run setup_server.sh on the server as root first, then retry."
  fi
  REMOTE_PASS=""  # Clear from memory immediately after use
  ok "SSH key installed — password no longer needed."
}

# ── Build frontend ────────────────────────────────────────────────────────────
build_frontend() {
  log "Building Angular frontend (production)..."
  cd "$SCRIPT_DIR/frontend"
  npm ci --silent
  npx ng build --configuration production --output-path "$BUILD_DIR/frontend"
  ok "Frontend built → $BUILD_DIR/frontend"
}

# ── Publish backend ───────────────────────────────────────────────────────────
build_backend() {
  log "Cleaning stale build artifacts..."
  cd "$SCRIPT_DIR/backend"
  dotnet clean src/Ihos.API/Ihos.API.csproj --configuration Release --nologo 2>/dev/null || true

  log "Publishing .NET backend (linux-x64, Release)..."
  dotnet publish src/Ihos.API/Ihos.API.csproj \
    --configuration Release \
    --runtime linux-x64 \
    --self-contained false \
    --output "$BUILD_DIR/api" \
    -p:PublishSingleFile=false \
    -p:DebugType=None \
    -p:DebugSymbols=false \
    --nologo
  ok "Backend published → $BUILD_DIR/api"

  # Bundle the reports folder alongside the API binaries
  if [ -d "$SCRIPT_DIR/reports" ]; then
    cp -r "$SCRIPT_DIR/reports" "$BUILD_DIR/api/reports"
    ok "Reports bundled → $BUILD_DIR/api/reports"
  else
    warn "reports/ folder not found — skipping."
  fi
}

# ── tar-over-SSH upload helper ────────────────────────────────────────────────
upload_dir() {
  local local_dir="$1"
  local remote_dir="$2"

  COPYFILE_DISABLE=1 tar -C "$local_dir" -czf - . \
  | ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=60 \
        "$REMOTE_USER@$REMOTE_HOST" \
        "mkdir -p '$remote_dir' && tar -C '$remote_dir' -xzf - --overwrite" \
  || die "Upload failed: $local_dir → $remote_dir"
}

# ── Deploy artifacts ──────────────────────────────────────────────────────────
deploy_artifacts() {
  log "Uploading API binaries → $APP_DIR ..."
  upload_dir "$BUILD_DIR/api" "$APP_DIR"
  ok "API binaries uploaded."

  log "Uploading frontend → $WEB_DIR ..."
  upload_dir "$BUILD_DIR/frontend/browser" "$WEB_DIR"
  ok "Frontend uploaded."

  # Drop a trigger file — the deploy watcher detects this and restarts ihos-api
  log "Triggering service restart via deploy watcher..."
  ssh -i "$SSH_KEY" \
      -o StrictHostKeyChecking=no \
      "$REMOTE_USER@$REMOTE_HOST" \
      "touch '$APP_DIR/.deploy_trigger'" \
  || warn "Could not send deploy trigger — restart ihos-api manually on the server."
  ok "Deploy trigger sent — server will restart the API automatically."
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}   IHOS Deployment → $DOMAIN${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo ""

  rm -rf "$BUILD_DIR" && mkdir -p "$BUILD_DIR"

  check_deps
  setup_ssh_auth
  build_frontend
  build_backend
  deploy_artifacts

  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   Deployment complete!${NC}"
  echo -e "${GREEN}   App  → http://$DOMAIN${NC}"
  echo -e "${GREEN}   API  → http://$DOMAIN/api${NC}"
  echo -e "${GREEN}   Logs → journalctl -u $SERVICE_NAME -f   (on server)${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  echo ""
}

main "$@"

ssh root@76.13.184.228 "systemctl restart ihos-api"    