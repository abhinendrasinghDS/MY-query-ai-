"""Deterministic and heuristic provider for tests and development without Ollama."""
import json
import re
from app.llm.contracts import SQLCandidate


class MockProvider:
    def __init__(self, note: str | None = None):
        self.note = note

    async def generate_sql(self, context: str) -> SQLCandidate:
        table_name = "school_enrolment_messy"
        schema_dict = {}
        question_text = ""

        q_match = re.search(r"User Question:\s*(.+?)(?:\n\n|$)", context, re.DOTALL)
        if q_match:
            question_text = q_match.group(1).strip()

        s_match = re.search(r"Discovered schema JSON:\s*(\{.*\})", context, re.DOTALL)
        if s_match:
            try:
                schema_dict = json.loads(s_match.group(1))
                if schema_dict:
                    table_name = list(schema_dict.keys())[0]
            except Exception:
                pass

        table_info = schema_dict.get(table_name, {})
        raw_cols = table_info.get("columns", []) if isinstance(table_info, dict) else []
        if isinstance(raw_cols, list):
            columns = [c["name"] for c in raw_cols if isinstance(c, dict) and "name" in c]
        elif isinstance(raw_cols, dict):
            columns = list(raw_cols.keys())
        else:
            columns = []

        q_lower = question_text.lower()
        assumptions: list[str] = []
        if self.note:
            assumptions.append(self.note)
        else:
            assumptions.append("Generated via My Query AI heuristic query engine.")

        # ── Detect dataset type ─────────────────────────────────────────────
        is_sales = any(c in columns for c in ["product_name", "total_amount", "salesperson", "unit_price"])
        is_school = any(c in columns for c in ["school_name", "enrolment", "academic_year"])

        sql = self._build_sales_sql(q_lower, columns, table_name, assumptions) if is_sales else \
              self._build_school_sql(q_lower, columns, table_name, assumptions)

        return SQLCandidate(
            sql=sql,
            assumptions=assumptions,
            needs_clarification=False,
            clarification_question=None,
        )

    def _build_sales_sql(self, q_lower: str, columns: list[str], table_name: str, assumptions: list[str]) -> str:
        """Generate SQL for sales datasets."""
        has_amount = "total_amount" in columns
        has_product = "product_name" in columns
        has_region = "region" in columns
        has_category = "category" in columns
        has_salesperson = "salesperson" in columns
        has_quantity = "quantity" in columns

        if any(w in q_lower for w in ["top", "sabse zyada", "highest", "best", "most", "sabse adhik", "most selling", "bikne wale"]):
            limit = 5
            m = re.search(r"\b(\d+)\b", q_lower)
            if m:
                limit = int(m.group(1))
            if has_salesperson and any(w in q_lower for w in ["salesperson", "agent", "seller", "kaun"]):
                assumptions.append(f"Ranking salespeople by total revenue, top {limit}.")
                return (f"SELECT salesperson, SUM(total_amount) as total_revenue, COUNT(*) as total_orders "
                        f"FROM {table_name} GROUP BY salesperson "
                        f"ORDER BY total_revenue DESC LIMIT {limit}")
            if has_region and any(w in q_lower for w in ["region", "area", "zone"]):
                assumptions.append(f"Aggregating sales by region, top {limit}.")
                return (f"SELECT region, SUM(total_amount) as total_sales, COUNT(*) as order_count "
                        f"FROM {table_name} WHERE total_amount IS NOT NULL "
                        f"GROUP BY region ORDER BY total_sales DESC LIMIT {limit}")
            if has_category and any(w in q_lower for w in ["category", "type", "kind"]):
                assumptions.append("Grouping by product category.")
                return (f"SELECT category, SUM(total_amount) as total_sales, COUNT(*) as orders "
                        f"FROM {table_name} GROUP BY category ORDER BY total_sales DESC LIMIT {limit}")
            # Default: top products
            if has_product and has_amount:
                assumptions.append(f"Ranking products by total sales revenue, top {limit}.")
                return (f"SELECT product_name, SUM(total_amount) as total_revenue, SUM(quantity) as total_qty "
                        f"FROM {table_name} WHERE total_amount IS NOT NULL "
                        f"GROUP BY product_name ORDER BY total_revenue DESC LIMIT {limit}")

        if any(w in q_lower for w in ["total", "kul", "sum", "kitni", "kitna", "total sales"]):
            if has_region and any(w in q_lower for w in ["region", "area", "zone", "region-wise"]):
                assumptions.append("Total sales grouped by region.")
                return (f"SELECT region, SUM(total_amount) as total_sales "
                        f"FROM {table_name} WHERE total_amount IS NOT NULL "
                        f"GROUP BY region ORDER BY total_sales DESC LIMIT 100")
            if has_category and any(w in q_lower for w in ["category", "type"]):
                assumptions.append("Total sales grouped by category.")
                return (f"SELECT category, SUM(total_amount) as total_sales "
                        f"FROM {table_name} GROUP BY category ORDER BY total_sales DESC")
            assumptions.append("Computing total sales revenue.")
            return (f"SELECT SUM(total_amount) as total_revenue, COUNT(*) as total_orders "
                    f"FROM {table_name} WHERE total_amount IS NOT NULL")

        if any(w in q_lower for w in ["average", "ausat", "avg", "mean"]):
            assumptions.append("Computing average order value.")
            return f"SELECT AVG(total_amount) as avg_order_value, COUNT(*) as total_orders FROM {table_name}"

        if any(w in q_lower for w in ["preview", "show", "sample", "dikhao", "first", "dekho"]):
            assumptions.append("Sampling first 20 records.")
            return f"SELECT * FROM {table_name} LIMIT 20"

        if any(w in q_lower for w in ["region", "area", "zone"]):
            assumptions.append("Region-wise sales breakdown.")
            return (f"SELECT region, SUM(total_amount) as total_sales, COUNT(*) as orders "
                    f"FROM {table_name} GROUP BY region ORDER BY total_sales DESC LIMIT 100")

        # Default: show all data
        if has_product and has_amount:
            col_list = ", ".join(c for c in ["product_name", "category", "region", "salesperson",
                                              "quantity", "total_amount"] if c in columns)
            assumptions.append("Showing sales records overview.")
            return f"SELECT {col_list} FROM {table_name} LIMIT 100"
        return f"SELECT * FROM {table_name} LIMIT 100"

    def _build_school_sql(self, q_lower: str, columns: list[str], table_name: str, assumptions: list[str]) -> str:
        """Generate SQL for school enrolment datasets."""
        if any(w in q_lower for w in ["falling", "girta", "decrease", "drop", "decline", "trend"]):
            if "school_name" in columns and "enrolment" in columns and "academic_year" in columns:
                extra = ", region" if "region" in columns else ""
                assumptions.append("Ordered chronologically to inspect falling trends.")
                return (f"SELECT school_name, academic_year, enrolment{extra} "
                        f"FROM {table_name} "
                        f"WHERE enrolment IS NOT NULL "
                        f"ORDER BY school_name, academic_year LIMIT 100")
            elif len(columns) >= 3:
                cols = ", ".join(columns[:4])
                return f"SELECT {cols} FROM {table_name} LIMIT 100"
            return f"SELECT * FROM {table_name} LIMIT 100"

        if any(w in q_lower for w in ["missing", "null", "quality"]):
            assumptions.append("Inspecting raw records to evaluate data completeness.")
            return f"SELECT * FROM {table_name} LIMIT 50"

        if any(w in q_lower for w in ["preview", "first", "sample", "show", "dikhao"]):
            assumptions.append("Sampling first 20 records.")
            return f"SELECT * FROM {table_name} LIMIT 20"

        if any(w in q_lower for w in ["total", "kul", "sum"]) and "enrolment" in columns:
            assumptions.append("Total enrolment by school or region.")
            if "region" in columns:
                return (f"SELECT region, SUM(enrolment) as total_enrolment "
                        f"FROM {table_name} WHERE enrolment IS NOT NULL "
                        f"GROUP BY region ORDER BY total_enrolment DESC")
            return f"SELECT school_name, SUM(enrolment) as total_enrolment FROM {table_name} WHERE enrolment IS NOT NULL GROUP BY school_name ORDER BY total_enrolment DESC"

        # Default
        if columns:
            cols = ", ".join(columns[:8])
            return f"SELECT {cols} FROM {table_name} LIMIT 100"
        return f"SELECT * FROM {table_name} LIMIT 100"
