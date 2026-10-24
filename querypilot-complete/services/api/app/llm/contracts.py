from pydantic import BaseModel, Field


class SQLCandidate(BaseModel):
    sql: str = Field(min_length=1, max_length=12000)
    assumptions: list[str] = []
    needs_clarification: bool = False
    clarification_question: str | None = None
