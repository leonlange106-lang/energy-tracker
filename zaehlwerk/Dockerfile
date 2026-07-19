FROM python:3.12-slim
WORKDIR /app

# Tesseract samt deutschen Sprachdaten und die von OpenCV benoetigten
# Systembibliotheken. libgl1 und libglib2.0-0 fehlen im slim-Abbild und sind
# auch fuer die headless-Variante erforderlich.
# Die Paketlisten werden im selben Schritt geloescht, damit sie nicht als
# Ebene im Abbild verbleiben.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-deu \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY frontend ./frontend
COPY run.sh /run.sh
RUN chmod +x /run.sh
CMD ["/run.sh"]
