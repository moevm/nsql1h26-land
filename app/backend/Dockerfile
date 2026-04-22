FROM python:3.12-slim AS builder

WORKDIR /tmp/build

ENV PATH="/opt/venv/bin:${PATH}"

RUN python -m venv /opt/venv

COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir --upgrade pip \
	&& pip install --no-cache-dir -r requirements.txt -c requirements.lock.txt

FROM python:3.12-slim

WORKDIR /app

ENV PATH="/opt/venv/bin:${PATH}" \
	PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

RUN useradd --create-home --shell /bin/bash appuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
