import pandas as pd
from app.connectors.csv_connector import ingest_csv
from app.connectors.sqlite_connector import SQLiteConnector


def test_csv_ingest_creates_sqlite_table(tmp_path):
    source = tmp_path / "schools.csv"
    pd.DataFrame({"school": ["A", "B"], "enrolment": [10, 8]}).to_csv(source, index=False)
    db_path, table, count = ingest_csv(source, tmp_path / "storage", source.name)
    schema = SQLiteConnector(db_path).schema()
    assert count == 2
    assert table in schema
    assert schema[table]["row_count"] == 2
