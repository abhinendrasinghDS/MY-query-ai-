import logging
import time
import uuid
from app.connectors.sqlite_connector import SQLiteConnector
from app.context.context_builder import build_schema_context
from app.core.config import get_settings
from app.llm.mock_provider import MockProvider
from app.llm.ollama_provider import OllamaProvider
from app.observability.events import StageTimer
from app.sql.policy import validate_readonly_sql
from app.validation.answerability import validate_result
from app.validation.answer_generator import generate_natural_answer

logger = logging.getLogger("querypilot.orchestration")


def _make_provider(provider_name: str, settings=None):
    """Factory: instantiate the correct LLM provider by name."""
    if settings is None:
        settings = get_settings()
    name = provider_name.lower()
    if name == "gemini":
        from app.llm.gemini_provider import GeminiProvider
        return GeminiProvider()
    if name == "grok":
        from app.llm.grok_provider import GrokProvider
        return GrokProvider()
    if name == "ollama":
        return OllamaProvider()
    if name == "mock":
        return MockProvider()
    raise ValueError(f"Unknown LLM provider: {provider_name!r}")


async def run_analysis(
    dataset: dict,
    question: str,
    llm_provider: str | None = None,
) -> dict:
    started = time.perf_counter()
    analysis_id = uuid.uuid4().hex
    connector = SQLiteConnector(dataset["storage_path"])
    with StageTimer("schema_discovery"):
        schema = connector.schema()
    context = build_schema_context(question, schema)

    settings = get_settings()
    # Per-request override > env config
    effective_provider = (llm_provider or settings.llm_provider).lower()

    with StageTimer("llm_generation"):
        if effective_provider == "mock":
            candidate = await MockProvider().generate_sql(context)
        elif effective_provider == "auto":
            # Cascade: Gemini → Grok → Ollama → Mock
            candidate = None
            tried = []
            cascade = []
            if settings.gemini_api_key:
                cascade.append(("gemini", lambda: _make_provider("gemini", settings)))
            if settings.grok_api_key:
                cascade.append(("grok", lambda: _make_provider("grok", settings)))
            cascade.append(("ollama", lambda: OllamaProvider()))
            for pname, pfactory in cascade:
                try:
                    candidate = await pfactory().generate_sql(context)
                    logger.info("Auto-selected LLM provider: %s", pname)
                    break
                except Exception as exc:
                    tried.append(pname)
                    logger.info("Provider %s unavailable (%s), trying next.", pname, exc)
            if candidate is None:
                fallback_note = (
                    f"All configured providers ({', '.join(tried)}) were unavailable. "
                    "Using QueryPilot local analysis engine as fallback."
                )
                candidate = await MockProvider(note=fallback_note).generate_sql(context)
        else:
            try:
                candidate = await _make_provider(effective_provider, settings).generate_sql(context)
            except Exception as exc:
                logger.warning("Provider %r failed: %s", effective_provider, exc)
                raise

    if candidate.needs_clarification:
        return {
            "id": analysis_id, "status": "abstained", "question": question,
            "answer": candidate.clarification_question or "The question needs clarification.",
            "sql": None, "columns": [], "rows": [], "warnings": [],
            "assumptions": candidate.assumptions,
            "llm_provider": effective_provider,
            "execution_ms": int((time.perf_counter() - started) * 1000),
        }
    with StageTimer("sql_validation"):
        validation = validate_readonly_sql(candidate.sql, allowed_tables=set(schema))
    if not validation.allowed:
        return {
            "id": analysis_id, "status": "abstained", "question": question,
            "answer": "I could not safely execute the generated query.",
            "sql": candidate.sql, "columns": [], "rows": [],
            "warnings": [validation.reason or "SQL policy rejected the query."],
            "assumptions": candidate.assumptions,
            "llm_provider": effective_provider,
            "execution_ms": int((time.perf_counter() - started) * 1000),
        }
    try:
        with StageTimer("query_execution"):
            result = connector.execute_readonly(
                validation.normalized_sql,
                settings.query_max_rows,
                settings.query_timeout_seconds,
            )
    except Exception:
        return {
            "id": analysis_id, "status": "failed", "question": question,
            "answer": "The query failed during execution. Review the schema and question, then try again.",
            "sql": validation.normalized_sql, "columns": [], "rows": [],
            "warnings": ["Execution failed; raw database error omitted from the response."],
            "assumptions": candidate.assumptions,
            "llm_provider": effective_provider,
            "execution_ms": int((time.perf_counter() - started) * 1000),
        }
    _, warnings = validate_result(question, schema, result.rows)
    # Generate a meaningful natural language answer from the results
    answer = generate_natural_answer(question, result.rows, result.columns, schema)
    return {
        "id": analysis_id, "status": "completed", "question": question,
        "answer": answer, "sql": validation.normalized_sql,
        "columns": result.columns, "rows": result.rows,
        "warnings": warnings, "assumptions": candidate.assumptions,
        "llm_provider": effective_provider,
        "execution_ms": int((time.perf_counter() - started) * 1000),
    }
