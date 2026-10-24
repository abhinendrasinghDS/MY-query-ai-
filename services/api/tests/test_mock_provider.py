import pytest
from app.llm.mock_provider import MockProvider
from app.orchestration.analysis import run_analysis
from app.connectors.csv_connector import ingest_csv
from pathlib import Path


@pytest.mark.asyncio
async def test_mock_provider_generates_valid_sql_for_falling_enrolment():
    context = """Question: Which schools had falling enrolment in the latest academic year?

Discovered schema JSON:
{"schools": {"columns": {"school_name": {"type": "TEXT"}, "academic_year": {"type": "TEXT"}, "enrolment": {"type": "INTEGER"}}}}
"""
    provider = MockProvider()
    candidate = await provider.generate_sql(context)
    assert "schools" in candidate.sql
    assert "enrolment" in candidate.sql
    assert not candidate.needs_clarification
    assert len(candidate.assumptions) > 0


@pytest.mark.asyncio
async def test_mock_provider_fallback_run_analysis(tmp_path):
    csv_file = tmp_path / "test.csv"
    csv_file.write_text("school_name,academic_year,enrolment\nSchool A,2023,100\nSchool A,2024,90\n")
    storage_dir = tmp_path / "sources"
    storage_dir.mkdir(parents=True, exist_ok=True)
    db_path, table_name, rows = ingest_csv(csv_file, storage_dir, "test.csv")

    dataset = {
        "id": "test-ds",
        "name": "test.csv",
        "table_name": table_name,
        "storage_path": str(db_path),
    }

    result = await run_analysis(dataset, "Which schools had falling enrolment?")
    assert result["status"] == "completed"
    assert len(result["rows"]) == 2
    assert "school_name" in result["columns"]
