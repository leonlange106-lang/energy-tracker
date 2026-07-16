# Eigenständiges Add-on-Image. Debian-slim -> reportlab-Wheels laufen ohne Build-Tools.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY frontend ./frontend
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
