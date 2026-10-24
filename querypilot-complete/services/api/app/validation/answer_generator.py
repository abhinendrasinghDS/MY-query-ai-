"""Natural language answer generator from SQL query results."""
from typing import Any


def generate_natural_answer(question: str, rows: list[dict], columns: list[str], schema: dict) -> str:
    """Convert query results into a meaningful natural language answer in English."""
    if not rows:
        return "No matching records found. The query executed successfully, but returned zero rows."

    q = question.lower()
    row_count = len(rows)

    # ── TOP / HIGHEST / BEST ──────────────────────────────────────────────────
    if any(w in q for w in ["top", "highest", "best", "most", "maximum", "peak", "sabse zyada", "sabse jyada"]):
        metric_col = _find_numeric_col(columns)
        name_col = _find_name_col(columns)
        if name_col and metric_col and rows:
            top = rows[0]
            top_name = top.get(name_col, "N/A")
            top_val = top.get(metric_col, "N/A")
            if row_count == 1:
                return f"The top record for '{metric_col}' is **{top_name}** with a value of **{_fmt(top_val)}**."
            else:
                others = ", ".join(str(r.get(name_col, "?")) for r in rows[1:min(4, row_count)])
                return (
                    f"Found top {row_count} results. The leading entry is **{top_name}** "
                    f"({metric_col}: {_fmt(top_val)}), followed by {others}."
                )

    # ── TOTAL / SUM ──────────────────────────────────────────────────────────
    if any(w in q for w in ["total", "sum", "overall", "aggregate", "kul", "kitna"]):
        metric_col = _find_numeric_col(columns)
        if metric_col and rows:
            total = sum(float(r[metric_col]) for r in rows if r.get(metric_col) is not None and r[metric_col] != "")
            dim_col = _find_name_col(columns)
            if dim_col and row_count > 1:
                return f"Total **{metric_col}** across {row_count} records is **{_fmt(total)}**."
            return f"Total **{metric_col}** is **{_fmt(total)}** (based on {row_count} records)."

    # ── AVERAGE / MEAN ───────────────────────────────────────────────────────
    if any(w in q for w in ["average", "avg", "mean", "ausat"]):
        metric_col = _find_numeric_col(columns)
        if metric_col and rows:
            vals = [float(r[metric_col]) for r in rows if r.get(metric_col) is not None and r[metric_col] != ""]
            if vals:
                avg = sum(vals) / len(vals)
                return f"The average **{metric_col}** is **{_fmt(avg)}** across {len(vals)} records."

    # ── COUNT / HOW MANY ─────────────────────────────────────────────────────
    if any(w in q for w in ["count", "how many", "number of", "kitne"]):
        if rows and len(columns) == 1:
            first_val = list(rows[0].values())[0]
            return f"Total count is **{_fmt(first_val)}** records/entries."
        return f"Found **{row_count}** matching records for this query."

    # ── FALLING / DECLINE / DROP ─────────────────────────────────────────────
    if any(w in q for w in ["falling", "decline", "drop", "decrease", "down", "girta"]):
        name_col = _find_name_col(columns)
        metric_col = _find_numeric_col(columns)
        if name_col:
            names = [str(r.get(name_col, "?")) for r in rows[:5]]
            return (
                f"Identified **{row_count}** records with a declining trend in '{metric_col or 'values'}', "
                f"including: {', '.join(names)}. View the Verified SQL tab for detailed trends."
            )

    # ── MISSING / NULL / QUALITY ─────────────────────────────────────────────
    if any(w in q for w in ["missing", "null", "quality", "anomaly", "anomalies"]):
        null_info = []
        for col in columns:
            null_count = sum(1 for r in rows if r.get(col) is None or r[col] == "")
            if null_count > 0:
                null_info.append(f"{col} ({null_count} NULLs)")
        if null_info:
            return f"Data quality issues found: {', '.join(null_info)} across {row_count} scanned records."
        return f"Scanned {row_count} records. No NULL values found in these columns."

    # ── PREVIEW / SAMPLE / SHOW ──────────────────────────────────────────────
    if any(w in q for w in ["preview", "show", "sample", "first", "display"]):
        return f"Here are the first **{row_count}** records from the dataset. See the table below for full details."

    # ── REGION / REGION WISE ─────────────────────────────────────────────────
    if any(w in q for w in ["region", "area", "zone", "state", "district"]):
        region_col = next((c for c in columns if "region" in c.lower() or "area" in c.lower()), None)
        metric_col = _find_numeric_col(columns)
        if region_col and metric_col and rows:
            top_region = rows[0]
            return (
                f"Regional analysis complete. "
                f"Leading region is **{top_region.get(region_col, 'N/A')}** with {metric_col}: {_fmt(top_region.get(metric_col, 'N/A'))}. "
                f"Total {row_count} regions represented."
            )

    # ── COMPARE / COMPARISON ─────────────────────────────────────────────────
    if any(w in q for w in ["compare", "comparison", "vs", "versus"]):
        return f"Comparison complete. **{row_count}** records retrieved. See the results table below."

    # ── DEFAULT ──────────────────────────────────────────────────────────────
    metric_col = _find_numeric_col(columns)
    name_col = _find_name_col(columns)
    if name_col and metric_col and row_count > 0:
        top = rows[0]
        return (
            f"Query executed successfully with **{row_count}** records returned. "
            f"Top entry: **{top.get(name_col, 'N/A')}** with {metric_col}: **{_fmt(top.get(metric_col, 'N/A'))}**. "
            f"All entries are listed in the table below."
        )
    return f"Query executed successfully. Retrieved **{row_count}** records. See the table below for full details."


def _find_numeric_col(columns: list[str]) -> str | None:
    """Find the most relevant numeric/metric column."""
    priority = ["total_amount", "amount", "sales", "revenue", "enrolment", "quantity",
                "price", "count", "value", "score", "profit", "total", "sum"]
    for p in priority:
        for c in columns:
            if p in c.lower():
                return c
    return next((c for c in columns if any(x in c.lower() for x in ["amount", "total", "count", "val", "num"])), None)


def _find_name_col(columns: list[str]) -> str | None:
    """Find the most relevant name/label column."""
    priority = ["product_name", "school_name", "name", "product", "category",
                "salesperson", "region", "customer_name", "title", "label"]
    for p in priority:
        for c in columns:
            if p == c.lower():
                return c
    for p in priority:
        for c in columns:
            if p in c.lower():
                return c
    return next((c for c in columns if any(x in c.lower() for x in ["name", "title", "label", "id"])), None)


def _fmt(val: Any) -> str:
    """Format numeric values nicely."""
    if val is None or val == "":
        return "N/A"
    try:
        f = float(val)
        if f == int(f):
            return f"{int(f):,}"
        return f"{f:,.2f}"
    except (ValueError, TypeError):
        return str(val)
