#!/usr/bin/env bash

# fossbot_app.sh
# Equivalent of the FossBot Physical Application systemd service

# Exit immediately if a command fails
set -e

# Environment variables
export ROBOT_MODE="physical"
export DOCKER="True"
export APP_DIR="/home/pi/.local/lib/python3.9/site-packages/blockly_server"
export SOCKETIO_ALLOWED_ORIGINS="*"

# Ensure we run from the correct directory
cd /home/pi

# Start the application
exec /home/pi/.local/bin/fossbot_app
