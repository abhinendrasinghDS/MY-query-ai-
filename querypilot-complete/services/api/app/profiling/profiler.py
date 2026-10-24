from collections import Counter
from app.connectors.sqlite_connector import SQLiteConnector


def profile_dataset(connector: SQLiteConnector) -> dict:
    schema = connector.schema()
    columns_out = []
    with connector._connect() as conn:
        for table, info in schema.items():
            qtable = table.replace('"', '""')
            for col in info["columns"]:
                qcol = col["name"].replace('"', '""')
                values = conn.execute(f'SELECT "{qcol}" FROM "{qtable}"').fetchmany(10000)
                vals = [v[0] for v in values]
                non_null = [v for v in vals if v is not None and str(v).strip() != ""]
                freq = Counter(str(v) for v in non_null)
                columns_out.append({
                    "table": table,
                    "name": col["name"],
                    "type": col["type"],
                    "null_count_sample": len(vals) - len(non_null),
                    "sample_size": len(vals),
                    "distinct_sample": len(freq),
                    "duplicate_value_candidates": [
                        {"value": k, "count": v} for k, v in freq.most_common(3) if v > 1
                    ],
                    "sample_values": list(dict.fromkeys(str(v) for v in non_null[:5])),
                })
    return {
        "row_count": sum(v.get("row_count", 0) for v in schema.values()),
        "column_count": len(columns_out),
        "columns": columns_out,
    }
