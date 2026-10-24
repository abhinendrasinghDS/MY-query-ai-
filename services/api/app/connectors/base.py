from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int


class DataConnector(ABC):
    @abstractmethod
    def schema(self) -> dict[str, Any]: ...

    @abstractmethod
    def execute_readonly(self, sql: str, max_rows: int, timeout_seconds: int) -> QueryResult: ...
