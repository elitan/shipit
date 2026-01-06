#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FROST_DIR="/opt/frost"
FROST_REPO="https://github.com/elitan/frost.git"
FROST_VERSION=""

while getopts "v:" opt; do
  case $opt in
    v) FROST_VERSION="$OPTARG" ;;
    *) echo "Usage: $0 [-v version]"; exit 1 ;;
  esac
done

echo -e "${GREEN}Frost Installation Script${NC}"
if [ -n "$FROST_VERSION" ]; then
  echo -e "Version: ${YELLOW}$FROST_VERSION${NC}"
fi
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Check if Linux
if [ "$(uname)" != "Linux" ]; then
  echo -e "${RED}This script only supports Linux${NC}"
  exit 1
fi

# Prompt for admin password
echo -e "${YELLOW}Configuration${NC}"
read -s -p "Admin password (min 8 chars): " FROST_PASSWORD
echo ""

if [ ${#FROST_PASSWORD} -lt 8 ]; then
  echo -e "${RED}Password must be at least 8 characters${NC}"
  exit 1
fi

# Generate JWT secret
FROST_JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"

# Install build tools
apt-get update -qq
apt-get install -y -qq git unzip build-essential > /dev/null

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "Docker already installed"
fi

# Install Caddy if not present
if ! command -v caddy &> /dev/null; then
  echo "Installing Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl > /dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' 2>/dev/null | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' 2>/dev/null | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq caddy > /dev/null
  systemctl enable caddy
else
  echo "Caddy already installed"
fi

# Configure Caddy to proxy to Frost
echo "Configuring Caddy..."
cat > /etc/caddy/Caddyfile << 'EOF'
:80 {
  reverse_proxy localhost:3000
}
EOF
systemctl restart caddy

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
else
  echo "Node.js already installed"
fi

# Install Bun if not present (needed for setup script)
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install 2>/dev/null | bash > /dev/null 2>&1
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "Bun already installed"
fi

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo ""
echo -e "${YELLOW}Setting up Frost...${NC}"

# Clone or update Frost
if [ -d "$FROST_DIR" ]; then
  echo "Removing existing installation..."
  rm -rf "$FROST_DIR"
fi

echo "Cloning Frost..."
git clone "$FROST_REPO" "$FROST_DIR"
cd "$FROST_DIR"

if [ -n "$FROST_VERSION" ]; then
  echo "Checking out version $FROST_VERSION..."
  git checkout "$FROST_VERSION"
fi

# Create data directory
mkdir -p "$FROST_DIR/data"

# Create .env file
cat > "$FROST_DIR/.env" << EOF
FROST_JWT_SECRET=$FROST_JWT_SECRET
NODE_ENV=production
EOF

# Install dependencies and build
echo "Installing dependencies..."
NODE_ENV=development npm install --legacy-peer-deps --silent

echo "Building..."
npm run build

# Run setup to set admin password (uses bun:sqlite)
echo "Setting admin password..."
bun run setup "$FROST_PASSWORD" || {
  echo -e "${RED}Failed to set admin password. Check bun installation.${NC}"
  exit 1
}

# Create systemd service
echo ""
echo -e "${YELLOW}Creating systemd service...${NC}"

cat > /etc/systemd/system/frost.service << EOF
[Unit]
Description=Frost
After=network.target docker.service caddy.service

[Service]
Type=simple
WorkingDirectory=$FROST_DIR
ExecStartPre=/bin/bash -c 'test -f $FROST_DIR/data/.update-requested && curl -fsSL https://raw.githubusercontent.com/elitan/frost/main/update.sh | bash -s -- --pre-start || true'
ExecStart=/usr/bin/npm run start
Restart=on-failure
EnvironmentFile=$FROST_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start services
systemctl daemon-reload
systemctl enable frost
systemctl restart frost

# Wait for Frost to start
echo "Waiting for Frost to start..."
sleep 3

# Health check
if curl -s -o /dev/null -w "" http://localhost:3000 2>/dev/null; then
  echo "Frost is running"
else
  echo -e "${YELLOW}Warning: Could not reach Frost. Check: journalctl -u frost -f${NC}"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || echo "YOUR_SERVER_IP")

# Generate API key from JWT secret
FROST_API_KEY=$(echo -n "${FROST_JWT_SECRET}frost-api-key" | sha256sum | cut -c1-32)

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "Frost is running at: ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -e "API Key: ${YELLOW}$FROST_API_KEY${NC}"
echo "(use with X-Frost-Token header)"
echo ""
echo "Next steps:"
echo "  1. Point your domain to $SERVER_IP"
echo "  2. Go to Settings in Frost to configure domain and SSL"
echo ""
echo "Useful commands:"
echo "  systemctl status frost    - check status"
echo "  systemctl restart frost   - restart"
echo "  journalctl -u frost -f    - view logs"
echo "  /opt/frost/update.sh      - update to latest version"
