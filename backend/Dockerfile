FROM python:3.12-slim

WORKDIR /app

# Nur requirements zuerst -> Docker-Layer-Cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App + Frontend
COPY app ./app
COPY frontend ./frontend

# Datenverzeichnis (SQLite) – wird per Volume überlagert
RUN mkdir -p /data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
