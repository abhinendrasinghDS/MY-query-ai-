import json
import re
import httpx
from app.core.config import get_settings
from app.llm.contracts import SQLCandidate


class OllamaProvider:
    def __init__(self):
        self.settings = get_settings()

    async def generate_sql(self, context: str) -> SQLCandidate:
        prompt = f'''{context}

Return ONLY valid JSON matching:
{{"sql":"SELECT ...","assumptions":[],"needs_clarification":false,"clarification_question":null}}
No markdown fences. SQL must be one read-only SELECT statement. Use a LIMIT no greater than 500.
'''
        url = self.settings.ollama_base_url.rstrip("/") + "/api/generate"
        async with httpx.AsyncClient(timeout=self.settings.ollama_timeout_seconds) as client:
            response = await client.post(url, json={
                "model": self.settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1},
            })
            response.raise_for_status()
            payload = response.json()
        raw = payload.get("response", "")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                raise ValueError("Model did not return valid structured JSON.")
            parsed = json.loads(match.group(0))
        return SQLCandidate.model_validate(parsed)
