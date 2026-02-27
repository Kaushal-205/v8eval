# Stage 1: Install heavy ML dependencies (maximizes layer cache)
FROM --platform=linux/amd64 python:3.11-slim AS ml-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir lm-eval transformers accelerate

# Stage 2: Final runtime image
FROM --platform=linux/amd64 python:3.11-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ml-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-deps /usr/local/bin /usr/local/bin

RUN pip install --no-cache-dir fastapi uvicorn[standard] eth-account python-dotenv

WORKDIR /app
COPY app.py eval_runner.py ./
RUN mkdir -p runs

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
