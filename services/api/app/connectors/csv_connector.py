from pathlib import Path
import re
import shutil
import sqlite3
import uuid
import pandas as pd
from app.connectors.sqlite_connector import SQLiteConnector


def safe_table_name(filename: str) -> str:
    stem = Path(filename).stem.lower()
    cleaned = re.sub(r"[^a-z0-9_]+", "_", stem).strip("_")
    if not cleaned or not cleaned[0].isalpha():
        cleaned = "db_" + cleaned
    return cleaned[:50]


def ingest_csv(csv_path: Path, storage_dir: Path, original_name: str) -> tuple[Path, str, int]:
    storage_dir.mkdir(parents=True, exist_ok=True)
    table_name = safe_table_name(original_name)
    db_path = storage_dir / f"{uuid.uuid4().hex}.sqlite3"
    frame = pd.read_csv(csv_path, low_memory=False)
    if frame.empty and len(frame.columns) == 0:
        raise ValueError("CSV must contain a header row.")
    frame.columns = [str(c).strip() or f"column_{i+1}" for i, c in enumerate(frame.columns)]
    with sqlite3.connect(db_path) as conn:
        frame.to_sql(table_name, conn, index=False, if_exists="replace")
    return db_path, table_name, len(frame)


def ingest_sqlite_db(source_path: Path, storage_dir: Path, original_name: str) -> tuple[Path, str, int]:
    """Ingest a native SQLite database (.db, .sqlite, .sqlite3)."""
    storage_dir.mkdir(parents=True, exist_ok=True)
    db_path = storage_dir / f"{uuid.uuid4().hex}.sqlite3"
    shutil.copyfile(source_path, db_path)

    with sqlite3.connect(db_path) as conn:
        # Verify database integrity
        integrity = conn.execute("PRAGMA quick_check").fetchone()
        if not integrity or integrity[0] != "ok":
            raise ValueError(f"SQLite database integrity check failed: {integrity}")

        tables = [
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        ]
        if not tables:
            raise ValueError("The uploaded SQLite database does not contain any user tables.")

        total_rows = 0
        for t in tables:
            quoted = t.replace('"', '""')
            try:
                count = conn.execute(f'SELECT COUNT(*) FROM "{quoted}"').fetchone()[0]
                total_rows += count
            except Exception:
                pass
        primary_table = tables[0]

    return db_path, primary_table, total_rows


def ingest_sql_dump(source_path: Path, storage_dir: Path, original_name: str) -> tuple[Path, str, int]:
    """Ingest a SQL dump script (.sql) into a fresh SQLite database."""
    storage_dir.mkdir(parents=True, exist_ok=True)
    db_path = storage_dir / f"{uuid.uuid4().hex}.sqlite3"
    with source_path.open("r", encoding="utf-8", errors="replace") as f:
        sql_content = f.read()

    with sqlite3.connect(db_path) as conn:
        conn.executescript(sql_content)
        tables = [
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        ]
        if not tables:
            raise ValueError("The SQL script executed, but no tables were created.")

        total_rows = 0
        for t in tables:
            quoted = t.replace('"', '""')
            try:
                count = conn.execute(f'SELECT COUNT(*) FROM "{quoted}"').fetchone()[0]
                total_rows += count
            except Exception:
                pass
        primary_table = tables[0]

    return db_path, primary_table, total_rows


__all__ = ["ingest_csv", "ingest_sqlite_db", "ingest_sql_dump", "SQLiteConnector"]
