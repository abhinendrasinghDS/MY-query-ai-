from app.sql.policy import validate_readonly_sql


def test_select_allowed_and_limit_added():
    result = validate_readonly_sql("SELECT name FROM schools", {"schools"})
    assert result.allowed
    assert "LIMIT" in result.normalized_sql.upper()


def test_delete_rejected():
    result = validate_readonly_sql("DELETE FROM schools", {"schools"})
    assert not result.allowed


def test_multiple_statements_rejected():
    result = validate_readonly_sql("SELECT 1; DROP TABLE schools", {"schools"})
    assert not result.allowed


def test_unknown_table_rejected():
    result = validate_readonly_sql("SELECT * FROM secrets", {"schools"})
    assert not result.allowed


def test_select_with_mutating_cte_rejected():
    result = validate_readonly_sql("WITH x AS (DELETE FROM schools RETURNING *) SELECT * FROM x", {"schools"})
    assert not result.allowed
