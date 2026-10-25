import json
import logging
import uuid
from pathlib import Path

import httpx
import pandas as pd
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.connectors.csv_connector import ingest_csv, ingest_sqlite_db, ingest_sql_dump
from app.connectors.sqlite_connector import SQLiteConnector
from app.core.config import get_settings
from app.core.errors import QueryPilotError
from app.db.models import AnalysisRecord, DatasetRecord
from app.db.session import get_db
from app.orchestration.analysis import run_analysis
from app.profiling.profiler import profile_dataset
from app.schemas import (
    AnalysisOut,
    AnalysisRequest,
    APIErrorOut,
    DatasetOut,
    DatasetSchemaOut,
    DatasetUploadOut,
    LLMSettingsOut,
    ProfileOut,
)

logger = logging.getLogger("querypilot.api")
router = APIRouter()
ERROR_RESPONSES = {
    status: {"model": APIErrorOut, "description": description}
    for status, description in {
        400: "The request could not be processed.",
        404: "The requested resource does not exist.",
        413: "The uploaded file exceeds the configured size limit.",
        422: "The request payload failed validation.",
        500: "An unexpected server error occurred.",
        502: "An upstream analysis provider failed.",
        503: "A required service is not ready.",
    }.items()
}
UPLOAD_CHUNK_SIZE = 1024 * 1024


def _dataset_out(record: DatasetRecord) -> dict:
    return {
        "id": record.id,
        "name": record.name,
        "kind": record.kind,
        "table_name": record.table_name,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def _get_dataset(dataset_id: str, db: Session) -> DatasetRecord:
    record = db.get(DatasetRecord, dataset_id)
    if not record:
        raise QueryPilotError("DATASET_NOT_FOUND", "Dataset not found.", status_code=404)
    return record


@router.get(
    "/datasets",
    tags=["datasets"],
    response_model=list[DatasetOut],
    responses=ERROR_RESPONSES,
    summary="List datasets",
    description="Returns uploaded datasets, newest first.",
)
def list_datasets(db: Session = Depends(get_db)):
    records = db.query(DatasetRecord).order_by(DatasetRecord.created_at.desc()).all()
    return [_dataset_out(record) for record in records]


@router.post(
    "/datasets/upload",
    tags=["datasets"],
    response_model=DatasetUploadOut,
    status_code=201,
    responses=ERROR_RESPONSES,
    summary="Upload a Database or Table",
    description="Stores a database file (SQLite .db, .sqlite, .sqlite3, SQL dump .sql, or CSV table) into the workspace.",
)
async def upload_database(file: UploadFile = File(...), db: Session = Depends(get_db)):
    settings = get_settings()
    filename = Path(file.filename or "").name
    ext = Path(filename).suffix.lower()
    allowed_exts = {".db", ".sqlite", ".sqlite3", ".sql", ".csv"}
    if not filename or ext not in allowed_exts:
        raise QueryPilotError(
            "UNSUPPORTED_FILE_TYPE",
            f"Unsupported file type '{ext}'. Supported database formats are: SQLite (.db, .sqlite, .sqlite3), SQL script (.sql), and CSV table (.csv).",
            status_code=400,
        )

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    temp_path = settings.data_dir / f"upload-{uuid.uuid4().hex}{ext}"
    total_bytes = 0
    try:
        with temp_path.open("wb") as destination:
            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > settings.upload_max_mb * 1024 * 1024:
                    raise QueryPilotError(
                        "UPLOAD_TOO_LARGE",
                        f"File exceeds the {settings.upload_max_mb} MB upload limit.",
                        status_code=413,
                    )
                destination.write(chunk)

        try:
            if ext in {".db", ".sqlite", ".sqlite3"}:
                kind = "sqlite"
                db_path, table_name, rows = ingest_sqlite_db(
                    temp_path,
                    settings.data_dir / "sources",
                    filename,
                )
            elif ext == ".sql":
                kind = "sql"
                db_path, table_name, rows = ingest_sql_dump(
                    temp_path,
                    settings.data_dir / "sources",
                    filename,
                )
            else:
                kind = "csv"
                db_path, table_name, rows = ingest_csv(
                    temp_path,
                    settings.data_dir / "sources",
                    filename,
                )
        except (
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
            UnicodeDecodeError,
            ValueError,
        ) as exc:
            raise QueryPilotError(
                "INVALID_DATABASE_FILE",
                f"The database file could not be parsed: {exc}",
                status_code=400,
            ) from exc
    finally:
        temp_path.unlink(missing_ok=True)
        await file.close()

    record = DatasetRecord(
        id=uuid.uuid4().hex,
        name=filename,
        kind=kind,
        table_name=table_name,
        storage_path=Path(db_path).as_posix(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {**_dataset_out(record), "row_count": rows}



def _find_demo_file(filename: str) -> Path:
    candidates = [
        Path("/app/datasets/demo") / filename,
        Path("datasets/demo") / filename,
        Path(__file__).resolve().parents[4] / "datasets" / "demo" / filename,
        Path(__file__).resolve().parent.parent.parent.parent / "datasets" / "demo" / filename,
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    raise QueryPilotError("DEMO_NOT_FOUND", f"Demo dataset file not found: {filename}", status_code=404)


@router.post(
    "/datasets/seed-demo",
    tags=["datasets"],
    response_model=DatasetUploadOut,
    status_code=201,
    responses=ERROR_RESPONSES,
    summary="Seed the messy demo dataset",
    description="Loads datasets/demo/school_enrolment_messy.csv directly into the workspace.",
)
def seed_demo_dataset(db: Session = Depends(get_db)):
    settings = get_settings()
    demo_file = _find_demo_file("school_enrolment_messy.csv")

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db_path, table_name, rows = ingest_csv(
        demo_file,
        settings.data_dir / "sources",
        "school_enrolment_messy.csv",
    )
    record = DatasetRecord(
        id=uuid.uuid4().hex,
        name="school_enrolment_messy.csv",
        kind="csv",
        table_name=table_name,
        storage_path=Path(db_path).as_posix(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {**_dataset_out(record), "row_count": rows}


@router.post(
    "/datasets/seed-sales-demo",
    tags=["datasets"],
    response_model=DatasetUploadOut,
    status_code=201,
    responses=ERROR_RESPONSES,
    summary="Seed the demo sales dataset",
    description="Loads datasets/demo/sales_data.csv (products, regions, salesperson data) into the workspace.",
)
def seed_sales_demo_dataset(db: Session = Depends(get_db)):
    settings = get_settings()
    demo_file = _find_demo_file("sales_data.csv")

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db_path, table_name, rows = ingest_csv(
        demo_file,
        settings.data_dir / "sources",
        "sales_data.csv",
    )
    record = DatasetRecord(
        id=uuid.uuid4().hex,
        name="sales_data.csv",
        kind="csv",
        table_name=table_name,
        storage_path=Path(db_path).as_posix(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {**_dataset_out(record), "row_count": rows}


@router.get(
    "/datasets/{dataset_id}/schema",
    tags=["datasets"],
    response_model=DatasetSchemaOut,
    responses=ERROR_RESPONSES,
    summary="Inspect dataset schema",
    description="Returns table names, column types, nullability, and row counts.",
)
def dataset_schema(dataset_id: str, db: Session = Depends(get_db)):
    record = _get_dataset(dataset_id, db)
    return {"dataset_id": dataset_id, "tables": SQLiteConnector(record.storage_path).schema()}


@router.get(
    "/datasets/{dataset_id}/profile",
    tags=["datasets"],
    response_model=ProfileOut,
    responses=ERROR_RESPONSES,
    summary="Profile a dataset",
    description=(
        "Returns row and column counts plus sampled missing-value and distinct-value metrics."
    ),
)
def dataset_profile(dataset_id: str, db: Session = Depends(get_db)):
    record = _get_dataset(dataset_id, db)
    return {"dataset_id": dataset_id, **profile_dataset(SQLiteConnector(record.storage_path))}


@router.post(
    "/analyses",
    tags=["analyses"],
    response_model=AnalysisOut,
    status_code=201,
    responses=ERROR_RESPONSES,
    summary="Analyze a dataset",
    description=(
        "Generates a read-only SQL query, validates it, and returns the answer and evidence."
    ),
)
async def create_analysis(payload: AnalysisRequest, db: Session = Depends(get_db)):
    record = _get_dataset(payload.dataset_id, db)
    try:
        result = await run_analysis(
            {
                "id": record.id,
                "name": record.name,
                "table_name": record.table_name,
                "storage_path": record.storage_path,
            },
            payload.question,
            llm_provider=payload.llm_provider,
            api_key=payload.api_key,
            model=payload.model,
        )
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Analysis provider failed: %s", type(exc).__name__)
        raise QueryPilotError(
            "ANALYSIS_PROVIDER_ERROR",
            "The analysis provider is unavailable or returned an invalid response.",
            status_code=502,
        ) from exc

    stored = AnalysisRecord(
        id=result["id"],
        dataset_id=record.id,
        question=payload.question,
        status=result["status"],
        result_json=json.dumps(result, default=str),
    )
    db.add(stored)
    db.commit()
    return result


@router.get(
    "/analyses/{analysis_id}",
    tags=["analyses"],
    response_model=AnalysisOut,
    responses=ERROR_RESPONSES,
    summary="Retrieve an analysis",
    description="Returns the saved answer, SQL, results, assumptions, and warnings.",
)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    record = db.get(AnalysisRecord, analysis_id)
    if not record:
        raise QueryPilotError("ANALYSIS_NOT_FOUND", "Analysis not found.", status_code=404)
    return json.loads(record.result_json or "{}")


# ─── LLM Provider Settings ──────────────────────────────────────────────────


@router.get(
    "/settings/llm",
    tags=["settings"],
    response_model=LLMSettingsOut,
    responses=ERROR_RESPONSES,
    summary="Get LLM provider configuration",
    description="Returns the configured LLM providers and which is active.",
)
def get_llm_settings():
    settings = get_settings()
    providers = [
        {
            "name": "gemini",
            "configured": bool(settings.gemini_api_key),
            "active": settings.llm_provider in ("gemini", "auto") and bool(settings.gemini_api_key),
            "model": settings.gemini_model,
        },
        {
            "name": "grok",
            "configured": bool(settings.grok_api_key),
            "active": settings.llm_provider in ("grok", "auto") and bool(settings.grok_api_key),
            "model": settings.grok_model,
        },
        {
            "name": "ollama",
            "configured": True,
            "active": settings.llm_provider in ("ollama", "auto"),
            "model": settings.ollama_model,
        },
        {
            "name": "mock",
            "configured": True,
            "active": settings.llm_provider == "mock",
            "model": "built-in",
        },
    ]
    return {"active_provider": settings.llm_provider, "providers": providers}
