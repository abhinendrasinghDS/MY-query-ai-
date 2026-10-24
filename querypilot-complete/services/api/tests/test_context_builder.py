from app.context.context_builder import build_schema_context


def test_context_includes_question_and_schema():
    context = build_schema_context("count schools", {"schools": {"columns": [{"name": "id"}]}})
    assert "count schools" in context
    assert "schools" in context
    assert "untrusted data" in context
