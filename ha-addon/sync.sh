#!/usr/bin/env sh
# Kopiert den aktuellen App-Stand ins Add-on-Paket. Aus dem Repo-Root ausführen:
#   sh ha-addon/sync.sh
set -e
cp -r backend/app ha-addon/energy_tracker/app
cp -r backend/frontend ha-addon/energy_tracker/frontend
cp backend/requirements.txt ha-addon/energy_tracker/requirements.txt
find ha-addon -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true
echo "Add-on synchronisiert (app, frontend, requirements)."
