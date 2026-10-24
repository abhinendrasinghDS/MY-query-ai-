from app.validation.answerability import validate_result


def test_empty_result_is_not_claimed_as_absence():
    answer, warnings = validate_result("find schools", {"schools": {"columns": []}}, [])
    assert "does not prove" in answer
