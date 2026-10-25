# 🚀 Deployment Guide — My Query AI

This guide covers deploying the **My Query AI** application (FastAPI backend + Next.js frontend) to production.

---

## 🌟 Option 1: Render Single Web Service (Unified Frontend + Backend) — Simplest & Recommended

The repository's root [`Dockerfile`](./Dockerfile) builds both the **Next.js frontend** and the **FastAPI backend** into a single container.

This means you only need **one service** on Render (e.g. `https://my-query-ai.onrender.com`), saving free hours and avoiding any CORS issues!

### 1. Push Code to GitHub
```bash
git add .
git commit -m "fix: unified frontend and backend deployment on render"
git push origin main
```

### 2. Connect to Render
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository `MY-query-ai-`.
4. Render settings:
   - **Name:** `my-query-ai`
   - **Region:** Oregon (or closest to you)
   - **Environment:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Plan:** Free
5. Add Environment Variables:
   | Key | Value / Description |
   |---|---|
   | `DATABASE_URL` | Neon PostgreSQL connection string (e.g. `postgresql://...neon.tech/mcqueen?sslmode=require`) |
   | `LLM_PROVIDER` | `auto` (or `gemini`, `grok`) |
   | `GEMINI_API_KEY` | Your Google Gemini API Key |
   | `GROK_API_KEY` | *(Optional)* Your xAI Grok API Key |
6. Click **Deploy Web Service**!

When live:
- **Web App / UI:** `https://my-query-ai.onrender.com/` (Home / Landing)
- **Login:** `https://my-query-ai.onrender.com/login`
- **Dashboard:** `https://my-query-ai.onrender.com/dashboard`
- **API Docs:** `https://my-query-ai.onrender.com/docs`
- **Health Check:** `https://my-query-ai.onrender.com/health/live`

---

## 🌟 Option 2: Render Blueprint (Separate Backend & Frontend Services)

The repository also includes [`render.yaml`](./render.yaml) if you prefer 2 separate services:

1. In Render Dashboard, click **New +** → **Blueprint**.
2. Select your repository `MY-query-ai-`.
3. Set the required environment variables in the Render dashboard for both `my-query-ai-api` and `my-query-ai-web`.

---

## ⚡ Option 3: Render (Backend) + Vercel (Frontend)

### Deploy Backend to Render:
1. Create a **Web Service** on Render from GitHub repository.
2. Root directory: `services/api` (Dockerfile: `./services/api/Dockerfile`).
3. Set environment variables (`DATABASE_URL`, `GEMINI_API_KEY`, `CORS_ORIGINS`).

### Deploy Frontend to Vercel:
1. Import repository on [Vercel](https://vercel.com).
2. Set Root Directory to `apps/web`.
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://my-query-ai-api.onrender.com/api/v1`
   - All `NEXT_PUBLIC_FIREBASE_*` variables.
4. Deploy!

---

## 🐳 Option 4: Self-Hosting with Docker Compose

Run full stack locally or on a VPS:

```bash
docker compose up -d --build
```

- Web UI: http://localhost:3000
- API Docs: http://localhost:8000/docs
- API Health: http://localhost:8000/health/live
