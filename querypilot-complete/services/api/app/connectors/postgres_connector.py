"""PostgreSQL source adapter.

Only instantiate with a server-managed, read-only connection string. Never accept
arbitrary user-supplied connection strings in a public deployment.
"""
from sqlalchemy import create_engine, inspect, text
from app.connectors.base import DataConnector, QueryResult


class PostgresConnector(DataConnector):
    def __init__(self, read_only_url: str, allowed_schema: str = "public"):
        if not read_only_url:
            raise ValueError("A server-managed PostgreSQL URL is required.")
        self.engine = create_engine(read_only_url, pool_pre_ping=True)
        self.allowed_schema = allowed_schema

    def schema(self):
        inspector = inspect(self.engine)
        result = {}
        for table in inspector.get_table_names(schema=self.allowed_schema):
            cols = inspector.get_columns(table, schema=self.allowed_schema)
            result[table] = {
                "columns": [
                    {"name": c["name"], "type": str(c["type"]), "nullable": c.get("nullable", True)}
                    for c in cols
                ]
            }
        return result

    def execute_readonly(self, sql, max_rows, timeout_seconds):
        with self.engine.connect() as conn:
            conn.exec_driver_sql("SET TRANSACTION READ ONLY")
            conn.execute(text(f"SET LOCAL statement_timeout = {int(timeout_seconds * 1000)}"))
            result = conn.execute(text(sql))
            cols = list(result.keys())
            rows = [dict(r._mapping) for r in result.fetchmany(max_rows)]
            return QueryResult(columns=cols, rows=rows, row_count=len(rows))
