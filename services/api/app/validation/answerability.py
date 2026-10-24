from datetime import datetime


def validate_result(question: str, schema: dict, rows: list[dict]) -> tuple[str, list[str]]:
    """Conservative guardrails; domain semantics should be expanded per dataset."""
    warnings = []
    if not rows:
        return "The query ran successfully but returned no matching rows. This does not prove the data is absent.", warnings
    lower_q = question.lower()
    schema_text = " ".join(schema.keys()).lower()
    if any(token in lower_q for token in ("last year", "previous year", "falling", "declin", "trend")):
        year_columns = []
        for table, meta in schema.items():
            for col in meta.get("columns", []):
                if any(x in col["name"].lower() for x in ("year", "date", "period")):
                    year_columns.append((table, col["name"]))
        if not year_columns:
            warnings.append("No obvious year/date/period column was discovered; time-based interpretation may be unreliable.")
    return "Query executed against the connected dataset. Review the SQL, assumptions, and warnings before relying on this result.", warnings
