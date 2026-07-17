#!/usr/bin/env sh
# Standalone: SQLite liegt im persistenten /data. Uvicorn lauscht auf dem Ingress-Port.
set -e
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
