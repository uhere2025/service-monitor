#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="service-monitor"
UNIT_FILE="$SCRIPT_DIR/$SERVICE_NAME.service"

sudo cp "$UNIT_FILE" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME"
