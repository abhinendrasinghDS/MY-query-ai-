from app.connectors.sqlite_connector import SQLiteConnector
from app.core.config import get_settings


def execute_query(connector: SQLiteConnector, sql: str):
    settings = get_settings()
    return connector.execute_readonly(
        sql=sql,
        max_rows=settings.query_max_rows,
        timeout_seconds=settings.query_timeout_seconds,
    )
