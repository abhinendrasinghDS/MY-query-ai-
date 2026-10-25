from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "My Query AI API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"
    database_url: str = "sqlite:///./data/querypilot_metadata.db"
    data_dir: Path = Path("./data")
    demo_dataset_dir: Path = Path("../../datasets/demo")
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    ollama_timeout_seconds: float = 90
    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash-latest"
    gemini_timeout_seconds: float = 60
    # xAI Grok
    grok_api_key: str = ""
    grok_model: str = "grok-beta"
    grok_timeout_seconds: float = 60
    query_timeout_seconds: int = 8
    query_max_rows: int = 500
    upload_max_mb: int = 20
    # Provider: "auto" | "ollama" | "gemini" | "grok" | "mock"
    llm_provider: str = "auto"

    model_config = SettingsConfigDict(
        env_file=(".env", "services/api/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
