"""Google Gemini LLM provider for SQL generation."""
import json
import re
import httpx
from app.core.config import get_settings
from app.llm.contracts import SQLCandidate

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiProvider:
    def __init__(self, model: str | None = None, api_key: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.gemini_model
        self.timeout = settings.gemini_timeout_seconds
        if not self.api_key:
            raise ValueError(
                "Gemini API key is not configured. "
                "Set GEMINI_API_KEY in the .env file or in the settings panel."
            )

    async def generate_sql(self, context: str) -> SQLCandidate:
        prompt = f"""{context}

Return ONLY valid JSON matching:
{{"sql":"SELECT ...","assumptions":[],"needs_clarification":false,"clarification_question":null}}
No markdown fences. SQL must be one read-only SELECT statement. Use a LIMIT no greater than 500.
"""
        url = f"{GEMINI_API_BASE}/{self.model}:generateContent?key={self.api_key}"
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            payload = response.json()

        # Extract text from Gemini response structure
        try:
            raw = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response structure: {payload}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                raise ValueError("Gemini did not return valid structured JSON.")
            parsed = json.loads(match.group(0))
        return SQLCandidate.model_validate(parsed)
