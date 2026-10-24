"""xAI Grok LLM provider for SQL generation (OpenAI-compatible API)."""
import json
import re
import httpx
from app.core.config import get_settings
from app.llm.contracts import SQLCandidate

GROK_API_BASE = "https://api.x.ai/v1"


class GrokProvider:
    def __init__(self, model: str | None = None, api_key: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.grok_api_key
        self.model = model or settings.grok_model
        self.timeout = settings.grok_timeout_seconds
        if not self.api_key:
            raise ValueError(
                "Grok API key is not configured. "
                "Set GROK_API_KEY in the .env file or in the settings panel."
            )

    async def generate_sql(self, context: str) -> SQLCandidate:
        prompt = f"""{context}

Return ONLY valid JSON matching:
{{"sql":"SELECT ...","assumptions":[],"needs_clarification":false,"clarification_question":null}}
No markdown fences. SQL must be one read-only SELECT statement. Use a LIMIT no greater than 500.
"""
        url = f"{GROK_API_BASE}/chat/completions"
        body = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a precise SQL generator. "
                        "Always respond with only a valid JSON object containing sql, "
                        "assumptions, needs_clarification, and clarification_question fields."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()

        try:
            raw = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Grok response structure: {payload}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                raise ValueError("Grok did not return valid structured JSON.")
            parsed = json.loads(match.group(0))
        return SQLCandidate.model_validate(parsed)
