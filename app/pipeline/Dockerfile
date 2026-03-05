# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    TRANSFORMERS_CACHE=/root/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR /app

# --- Зависимости (отдельный слой, кэшируется) ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Код пайплайна ---
COPY . /app/

# --- Предзагрузка модели в образ (делается один раз при сборке) ---
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading model...'); \
SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'); \
print('Model cached.')"

# Директория для данных — монтируется при запуске контейнера
VOLUME ["/app/data"]

# По умолчанию: топ-20 без запроса, с кэшем
ENTRYPOINT ["python", "pipeline.py"]
CMD []
