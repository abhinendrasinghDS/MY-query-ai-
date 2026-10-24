from dataclasses import dataclass
import sqlglot
from sqlglot import exp


@dataclass
class SQLValidation:
    allowed: bool
    normalized_sql: str | None
    reason: str | None


DENIED_NODES = (
    exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter,
    exp.Command, exp.Transaction, exp.Merge, exp.Copy,
)


def validate_readonly_sql(sql: str, allowed_tables: set[str] | None = None) -> SQLValidation:
    if not sql or not sql.strip():
        return SQLValidation(False, None, "SQL is empty.")
    try:
        statements = sqlglot.parse(sql, read="sqlite")
    except Exception:
        return SQLValidation(False, None, "SQL could not be parsed.")
    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        return SQLValidation(False, None, "Exactly one SQL statement is allowed.")
    tree = statements[0]
    if not isinstance(tree, (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        return SQLValidation(False, None, "Only read-only SELECT queries are allowed.")
    for node in tree.walk():
        if isinstance(node, DENIED_NODES):
            return SQLValidation(False, None, "Mutating or administrative SQL is forbidden.")
        if isinstance(node, exp.Func):
            name = node.sql_name().upper()
            if name in {"LOAD_EXTENSION", "READFILE", "WRITEFILE", "SHELL", "EVAL"}:
                return SQLValidation(False, None, f"Function {name} is not allowed.")
    if allowed_tables is not None:
        referenced = {t.name for t in tree.find_all(exp.Table)}
        bad = referenced - allowed_tables
        if bad:
            return SQLValidation(False, None, "Query references tables outside the discovered schema.")
    limit = tree.args.get("limit")
    if limit is None:
        tree = tree.limit(500)
    else:
        try:
            n = int(limit.expression.this)
            if n > 500:
                tree.set("limit", exp.Limit(expression=exp.Literal.number(500)))
        except Exception:
            return SQLValidation(False, None, "LIMIT must be a numeric literal.")
    return SQLValidation(True, tree.sql(dialect="sqlite"), None)
