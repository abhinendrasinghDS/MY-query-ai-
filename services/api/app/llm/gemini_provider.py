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
        models_to_try = [self.model]
        for fallback in ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        payload = None
        last_error = None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for model_name in models_to_try:
                url = f"{GEMINI_API_BASE}/{model_name}:generateContent?key={self.api_key}"
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    response = await client.post(url, json=body)
                    if response.status_code == 404:
                        # Model not available in this tier/version, try next
                        last_error = response.text
                        continue
                    response.raise_for_status()
                    payload = response.json()
                    break
                except httpx.HTTPStatusError as exc:
                    try:
                        err_json = exc.response.json()
                        err_msg = err_json.get("error", {}).get("message", exc.response.text)
                    except Exception:
                        err_msg = exc.response.text
                    last_error = err_msg
                    if exc.response.status_code == 404:
                        continue
                    raise ValueError(f"Gemini API error ({exc.response.status_code}): {err_msg}") from exc
                except Exception as exc:
                    last_error = str(exc)
                    raise

        if not payload:
            raise ValueError(f"Gemini generation failed on all models ({', '.join(models_to_try)}): {last_error}")

        # Extract text from Gemini response structure
        try:
            raw = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response structure: {payload}") from exc

        # Strip any markdown code fences if present
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if not match:
                raise ValueError(f"Gemini did not return valid structured JSON: {raw[:200]}")
            parsed = json.loads(match.group(0))
        return SQLCandidate.model_validate(parsed)
