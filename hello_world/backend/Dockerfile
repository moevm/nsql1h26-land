FROM python:3.12-slim AS builder
WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install/deps /usr/local
COPY app.py .
EXPOSE 5000
CMD ["python", "-u", "app.py"]
