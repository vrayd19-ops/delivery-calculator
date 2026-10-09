FROM python:3.11-slim

WORKDIR /app

ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
ENV FLAGS_use_mkldnn=0
ENV FLAGS_enable_pir_api=0

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip

RUN pip install --no-cache-dir "paddlepaddle==3.2.2"

RUN pip install --no-cache-dir "paddleocr[all]==3.7.0"

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart

COPY . .

EXPOSE 8000

CMD ["python", "server.py"]