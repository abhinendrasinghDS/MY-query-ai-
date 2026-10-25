import sqlite3
from pathlib import Path
from typing import Any
from app.connectors.base import DataConnector, QueryResult


class SQLiteConnector(DataConnector):
    def __init__(self, path: str | Path):
        # Normalize: replace Windows backslashes with forward slashes
        # so paths stored on Windows work correctly on Linux (Render)
        normalized = str(path).replace("\\", "/")
        self.path = Path(normalized).resolve()
        if not self.path.exists():
            raise FileNotFoundError(f"Dataset storage not found: {self.path}")

    def _connect(self):
        uri = self.path.as_uri() + "?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only = ON")
        return conn

    def schema(self) -> dict[str, Any]:
        with self._connect() as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
            result = {}
            for row in tables:
                table = row["name"]
                quoted = table.replace('"', '""')
                cols = conn.execute(f'PRAGMA table_info("{quoted}")').fetchall()
                count = conn.execute(f'SELECT COUNT(*) FROM "{quoted}"').fetchone()[0]
                result[table] = {
                    "row_count": count,
                    "columns": [
                        {"name": c["name"], "type": c["type"] or "UNKNOWN", "nullable": not bool(c["notnull"])}
                        for c in cols
                    ],
                }
            return result

    def execute_readonly(self, sql: str, max_rows: int, timeout_seconds: int) -> QueryResult:
        conn = self._connect()
        conn.set_progress_handler(lambda: 1, max(1000, timeout_seconds * 100000))
        try:
            cur = conn.execute(sql)
            columns = [d[0] for d in (cur.description or [])]
            raw = cur.fetchmany(max_rows + 1)
            rows = [dict(r) for r in raw[:max_rows]]
            return QueryResult(columns=columns, rows=rows, row_count=len(rows))
        finally:
            conn.close()
