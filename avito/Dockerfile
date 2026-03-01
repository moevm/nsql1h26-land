# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Убираем предупреждение HuggingFace о symlinks (актуально для Windows-хостов)
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    # Модель кэшируется в образе при сборке
    TRANSFORMERS_CACHE=/root/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR /app

# --- Зависимости (отдельный слой, кэшируется) ---
COPY avito/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# --- Код пайплайна ---
COPY avito/ /app/avito/

# --- Предзагрузка модели в образ (делается один раз при сборке) ---
# Экономит ~1-2 мин при каждом запуске контейнера
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading model...'); \
SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'); \
print('Model cached.')"

# Директория для данных и кэша — монтируется при запуске контейнера
VOLUME ["/app/data"]

WORKDIR /app/avito

# По умолчанию: топ-20 без запроса, с кэшем
ENTRYPOINT ["python", "pipeline.py"]
CMD []
