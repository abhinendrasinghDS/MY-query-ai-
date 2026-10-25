from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints


class DatasetOut(BaseModel):
    id: str
    name: str
    kind: str
    table_name: str
    created_at: str | None = None


class DatasetUploadOut(DatasetOut):
    row_count: int


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool | None = None


class TableSchema(BaseModel):
    columns: list[ColumnInfo]
    row_count: int | None = None


class DatasetSchemaOut(BaseModel):
    dataset_id: str
    tables: dict[str, TableSchema]


class AnalysisRequest(BaseModel):
    dataset_id: str = Field(min_length=1, max_length=64)
    question: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=5, max_length=2000),
    ]
    # Per-request provider override: "auto" | "ollama" | "gemini" | "grok" | "mock"
    llm_provider: str | None = None
    # User's manual API key (e.g. Google Gemini AI Studio key from browser)
    api_key: str | None = None
    # Optional model override (e.g. gemini-1.5-flash, gemini-2.0-flash)
    model: str | None = None


class AnalysisOut(BaseModel):
    id: str
    status: Literal["completed", "abstained", "failed"]
    question: str
    answer: str
    sql: str | None = None
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    llm_provider: str | None = None
    execution_ms: int | None = None


class ProfileOut(BaseModel):
    dataset_id: str
    row_count: int
    column_count: int
    columns: list[dict[str, Any]]


class ValidationIssue(BaseModel):
    field: str
    message: str
    type: str


class APIError(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[ValidationIssue] | None = None


class APIErrorOut(BaseModel):
    error: APIError


class HealthOut(BaseModel):
    status: Literal["ok", "ready"]


class LLMProviderStatus(BaseModel):
    name: str
    configured: bool
    active: bool
    model: str


class LLMSettingsOut(BaseModel):
    active_provider: str
    providers: list[LLMProviderStatus]
