.PHONY: api web test

api:
	cd services/api && uvicorn app.main:app --reload --port 8000

web:
	cd apps/web && npm run dev

test:
	cd services/api && pytest
