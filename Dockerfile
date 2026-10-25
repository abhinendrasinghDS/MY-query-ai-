# Root Dockerfile for My Query AI — Unified Fullstack Service (Frontend + Backend)
# ── Stage 1: Build Frontend (Next.js static export) ─────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci
COPY apps/web/ ./
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

RUN npm run build

# ── Stage 2: Build Python Backend ───────────────────────────────────────────
FROM python:3.12-slim AS backend-builder
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/api/pyproject.toml ./
COPY services/api/README.md* ./
RUN pip install --upgrade pip && pip install --no-cache-dir .

# ── Stage 3: Runtime (Unified Frontend + Backend) ───────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    APP_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

COPY services/api/app ./app
# Copy static frontend export directly into /app/static for FastAPI to serve
COPY --from=frontend-builder /web/out ./static

RUN mkdir -p /app/data/sources && chmod -R 777 /app/data

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
