# Stage 1: Build Next.js static export
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Install heavy ML dependencies separately (maximizes layer cache)
FROM --platform=linux/amd64 python:3.11-slim AS ml-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
# Install torch first (largest dep — cached as its own layer)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# Install remaining ML deps
RUN pip install --no-cache-dir lm-eval transformers accelerate

# Stage 3: Final runtime image
FROM --platform=linux/amd64 python:3.11-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from ml-deps stage
COPY --from=ml-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-deps /usr/local/bin /usr/local/bin

# Install small app deps
RUN pip install --no-cache-dir fastapi uvicorn[standard] eth-account python-dotenv

WORKDIR /app
COPY app.py eval_runner.py ./
COPY --from=frontend /app/frontend/out ./frontend/out
RUN mkdir -p runs

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
