# QueryPilot — Complete Modular Starter

A modular full-stack AI data analysis platform starter. It includes a Next.js/TypeScript frontend, FastAPI backend, modular data connectors, schema discovery, profiling, Ollama/Qwen-compatible LLM provider, SQL policy validation, bounded read-only execution, analysis orchestration, app metadata models, tests, demo data, Docker Compose, and docs.

> This is a complete **development starter**, not a production-certified service. Before exposing it publicly, add real authentication/authorization, encrypted secret storage, hardened tenant isolation, rate limiting, security review, and broader integration tests. SQL parser checks are defense-in-depth; database-native read-only permissions remain mandatory.

## Project layout

```text
querypilot/
├── apps/web/                 # Next.js UI
├── services/api/app/
│   ├── api/                  # HTTP routes
│   ├── core/                 # config/errors
│   ├── db/                   # app metadata SQLAlchemy models/session
│   ├── connectors/           # CSV, SQLite, PostgreSQL adapters
│   ├── discovery/            # schema inspection
│   ├── profiling/            # data-quality profiles
│   ├── context/              # schema context builder
│   ├── llm/                  # Ollama provider + contracts
│   ├── sql/                  # SQL policy and validation
│   ├── execution/            # bounded query execution
│   ├── validation/           # answerability checks
│   ├── orchestration/        # end-to-end analysis pipeline
│   └── observability/        # sanitized events
├── datasets/demo/            # intentionally messy school dataset
├── docs/                     # architecture, security, evaluation, API
├── scripts/                  # local helper scripts
└── docker-compose.yml
```

## Requirements

- Python 3.10+
- Node.js 18+
- Ollama (optional for local LLM mode; includes automatic intelligent fallback engine if Ollama is not installed/running)
- Docker Compose is optional

## Quick start

### Easiest: One-Click Launcher (Windows)
Double-click `run-dev.bat` or run in PowerShell:
```powershell
.\run-dev.ps1
```
This automatically starts both the FastAPI backend on `http://localhost:8000` and the Next.js UI on `http://localhost:3000`.

### Manual Start

#### 1. Backend

```bash
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```
Swagger docs: http://localhost:8000/docs

#### 2. Frontend

```bash
cd apps/web
npm run dev
```

Swagger docs: http://localhost:8000/docs

### 2. Frontend

In another terminal:

```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

### 3. Local model

```bash
ollama pull qwen3:8b
```

Ensure Ollama is available at `http://localhost:11434`. The backend uses the model name from `OLLAMA_MODEL`.

### 4. Try the demo dataset

Upload `datasets/demo/school_enrolment_messy.csv` through the UI. Example question:

> Which schools had falling enrolment in the latest academic year?

The current implementation supports CSV uploads and SQL-backed execution. The model generates a candidate SQL query based on discovered schema; the policy layer validates it before execution. The system abstains when it detects insufficient historical periods or unsafe/invalid SQL. Because messy-data semantics vary, inspect the assumptions and query before using results for consequential decisions.

## Docker Compose

```bash
docker compose up --build
```

Compose starts the API, web app, and PostgreSQL metadata database. Ollama runs on the host by default; set `OLLAMA_BASE_URL` appropriately for your environment. Model weights are not downloaded automatically.

## Main API routes

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/datasets`
- `POST /api/v1/datasets/upload` (multipart CSV)
- `GET /api/v1/datasets/{dataset_id}/schema`
- `GET /api/v1/datasets/{dataset_id}/profile`
- `POST /api/v1/analyses`
- `GET /api/v1/analyses/{analysis_id}`

## Tests

```bash
cd services/api
pip install -e ".[dev]"
pytest
```

Frontend checks:

```bash
cd apps/web
npm install
npm run lint
npm run build
```

## Important security boundaries

- The included SQLite demo engine is stored under `data/` and only the backend can access it.
- Do not accept arbitrary source connection strings from untrusted users.
- Use database-native read-only credentials for PostgreSQL sources.
- Keep metadata DB separate from user source databases.
- Set TLS, authentication, project authorization, upload quotas, rate limits, and encrypted secret management before production.
- Never send raw data rows or credentials to logs or model prompts unnecessarily.
