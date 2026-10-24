from app.connectors.sqlite_connector import SQLiteConnector


def discover_sqlite(connector: SQLiteConnector) -> dict:
    """Return discovered table/column metadata from the source database."""
    return connector.schema()
