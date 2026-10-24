import json


def build_schema_context(question: str, schema: dict) -> str:
    """Compact schema context with multi-lingual (English, Hindi, Hinglish) understanding.

    Supports both school enrolment datasets and business/sales datasets.
    """
    # Auto-detect dataset type for better hints
    schema_str = json.dumps(schema, ensure_ascii=False, default=str).lower()
    is_sales = any(k in schema_str for k in ["product", "sales", "amount", "revenue", "salesperson"])
    is_school = any(k in schema_str for k in ["school", "enrolment", "enrollment", "academic"])

    dataset_hint = ""
    if is_sales:
        dataset_hint = (
            "This is a SALES dataset with columns like product_name, region, salesperson, "
            "total_amount, quantity, category, sale_date, customer_name.\n"
            "Sales-specific mappings:\n"
            "- 'sabse zyada bikne wale' / 'top selling' → ORDER BY total_amount DESC or quantity DESC\n"
            "- 'kaun sa product' / 'which product' → product_name\n"
            "- 'kis region' / 'region-wise' → GROUP BY region\n"
            "- 'kul bikri' / 'total sales' → SUM(total_amount)\n"
            "- 'kaun sa salesperson' / 'best salesperson' → GROUP BY salesperson ORDER BY SUM(total_amount) DESC\n"
            "- 'pichhle mahine' / 'last month' → filter sale_date by month"
        )
    elif is_school:
        dataset_hint = (
            "This is a SCHOOL ENROLMENT dataset with columns like school_name, school_id, "
            "academic_year, enrolment, region, inspection_date.\n"
            "School-specific mappings:\n"
            "- 'girta hua' / 'falling' → schools where enrolment decreased across years\n"
            "- 'sabse zyada' students → ORDER BY enrolment DESC\n"
            "- 'region-wise' → GROUP BY region\n"
            "- 'spelling variation' → school names with duplicates/inconsistencies"
        )

    parts = [
        "You are an expert bilingual data analyst (English + Hindi/Hinglish).",
        "Your task: Translate natural language questions into safe, read-only SQLite SQL queries.",
        (
            "The user's question may be in English, Hindi (Devanagari), or Hinglish "
            "(Romanized Hindi, e.g., 'sabse zyada bikne wale 5 products', "
            "'kaunse region mein total sales highest hai', 'pichhle mahine ka data', "
            "'kul bikri kitni hui', 'top 5 products kaun se hain')."
        ),
        "General Hindi/Hinglish → SQL mappings:",
        "- 'sabse zyada' / 'top' / 'highest' → ORDER BY <col> DESC LIMIT N",
        "- 'sabse kam' / 'lowest' / 'minimum' → ORDER BY <col> ASC LIMIT N",
        "- 'kul' / 'total' / 'sum' → SUM(<col>)",
        "- 'ausat' / 'average' → AVG(<col>)",
        "- 'kitne' / 'count' / 'how many' → COUNT(*) or COUNT(<col>)",
        "- 'pichhle mahine' / 'last month' → filter date column by month",
        "- 'region-wise' / 'category-wise' → GROUP BY that column",
        "- 'bikne wale' / 'selling' / 'sales' → sales or amount columns",
        "- 'dikhao' / 'show' / 'preview' → SELECT * LIMIT 20",
    ]

    if dataset_hint:
        parts.append(dataset_hint)

    parts += [
        "Rules:",
        "1. Only use tables and columns explicitly listed in the Discovered schema JSON below.",
        "2. Generate exactly ONE read-only SELECT statement.",
        "3. Always include GROUP BY when using aggregate functions with non-aggregated columns.",
        "4. Filter NULL metric values where relevant (e.g. WHERE <metric> IS NOT NULL).",
        "5. If a limit is requested (e.g. '5 products', 'top 10'), add LIMIT; else default LIMIT <= 100.",
        "6. For 'pichhle mahine' (last month): use strftime('%Y-%m', date_col) filtering.",
        "7. For comparisons across time: ORDER BY date column.",
        f"User Question: {question}",
        "Discovered schema JSON:",
        json.dumps(schema, ensure_ascii=False, default=str)[:18000],
    ]
    return "\n\n".join(parts)
