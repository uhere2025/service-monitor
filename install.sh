#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="service-monitor"
TEMPLATE_FILE="$SCRIPT_DIR/$SERVICE_NAME.service.template"
UNIT_FILE="$SCRIPT_DIR/$SERVICE_NAME.service"

# Host-specific values, detected at install time (see the template's __PLACEHOLDERS__).
SERVICE_USER="$(whoami)"
WORKDIR="$SCRIPT_DIR"
NODE_BIN_DIR="$(dirname "$(command -v node)")"

sed \
  -e "s|__USER__|$SERVICE_USER|g" \
  -e "s|__WORKDIR__|$WORKDIR|g" \
  -e "s|__NODE_BIN_DIR__|$NODE_BIN_DIR|g" \
  "$TEMPLATE_FILE" > "$UNIT_FILE"

sudo cp "$UNIT_FILE" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME"
