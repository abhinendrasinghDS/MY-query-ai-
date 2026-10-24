# 🚀 Deployment Guide — My Query AI

This guide covers deploying the **My Query AI** application (FastAPI backend + Next.js frontend) to production.

---

## 🌟 Option 1: Render One-Click / Blueprint (Recommended)

The repository includes a ready-to-use [`render.yaml`](./render.yaml) specification.

### 1. Push Code to GitHub
Ensure this repository is pushed to your GitHub account:
```bash
git push origin main
```

### 2. Connect to Render
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Select your GitHub repository `MY-query-ai-`.
4. Render will detect `render.yaml` and configure two services:
   - `my-query-ai-api` (Docker web service)
   - `my-query-ai-web` (Docker web service)

### 3. Configure Environment Variables in Render Dashboard

#### Backend (`my-query-ai-api`):
| Key | Value / Description |
|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string (e.g. `postgresql://...neon.tech/mcqueen?sslmode=require`) |
| `CORS_ORIGINS` | `https://my-query-ai-web.onrender.com,http://localhost:3000` *(replace with your frontend URL)* |
| `LLM_PROVIDER` | `auto` (or `gemini`, `grok`) |
| `GEMINI_API_KEY` | Your Google Gemini API Key from Google AI Studio |
| `GROK_API_KEY` | *(Optional)* Your xAI Grok API Key |

#### Frontend (`my-query-ai-web`):
| Key | Value / Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://my-query-ai-api.onrender.com/api/v1` *(your Render API URL)* |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your Firebase API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `my-query-ai.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `my-query-ai` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `my-query-ai.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| Your Firebase Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Your Firebase App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Your Measurement ID |

---

## ⚡ Option 2: Render (Backend) + Vercel (Frontend)

### Deploy Backend to Render:
1. Create a **Web Service** on Render from GitHub repository.
2. Root directory: `querypilot-complete/services/api` (or root with Dockerfile `./services/api/Dockerfile`).
3. Set environment variables (see above table).

### Deploy Frontend to Vercel:
1. Import repository on [Vercel](https://vercel.com).
2. Set Root Directory to `querypilot-complete/apps/web`.
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://my-query-ai-api.onrender.com/api/v1`
   - All `NEXT_PUBLIC_FIREBASE_*` variables.
4. Deploy!

---

## 🐳 Option 3: Self-Hosting with Docker Compose

Run full stack locally or on a VPS (AWS EC2, DigitalOcean, Hetzner, etc.):

```bash
cd querypilot-complete

# Copy environment files
cp .env.example .env
cp services/api/.env.example services/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# Fill in your keys in .env and .env.local

# Start all containers
docker compose up -d --build
```

- Web UI: http://localhost:3000
- API Docs: http://localhost:8000/docs
- API Health: http://localhost:8000/health/live
