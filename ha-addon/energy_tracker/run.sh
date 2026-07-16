#!/usr/bin/env sh
# Optionen (influx_url/token/org/bucket) liest die App selbst aus /data/options.json (config.py).
# SQLite liegt im persistenten /data. Uvicorn lauscht auf dem Ingress-Port.
set -e
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
