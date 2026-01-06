#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FROST_DIR="/opt/frost"
UPDATE_MARKER="$FROST_DIR/data/.update-requested"
PRE_START=false

if [ "$1" = "--pre-start" ]; then
  PRE_START=true
fi

echo -e "${GREEN}Frost Update Script${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Check if Frost is installed
if [ ! -d "$FROST_DIR" ]; then
  echo -e "${RED}Frost not found at $FROST_DIR${NC}"
  echo "Run install.sh first"
  exit 1
fi

# Remove update marker if present (triggered from UI)
if [ -f "$UPDATE_MARKER" ]; then
  rm "$UPDATE_MARKER"
  echo -e "${YELLOW}Update triggered from UI${NC}"
fi

cd "$FROST_DIR"

if [ "$PRE_START" = false ]; then
  echo -e "${YELLOW}Stopping Frost...${NC}"
  systemctl stop frost 2>/dev/null || true
fi

echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull origin main

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --legacy-peer-deps --silent

echo -e "${YELLOW}Building...${NC}"
npm run build

if [ "$PRE_START" = false ]; then
  echo -e "${YELLOW}Starting Frost...${NC}"
  systemctl start frost
fi

echo ""
echo -e "${GREEN}Update complete!${NC}"
echo ""
if [ "$PRE_START" = true ]; then
  echo "Frost will start automatically"
else
  echo "Check status: systemctl status frost"
fi
