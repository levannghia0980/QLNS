from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./internship.db"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    FALLBACK_THRESHOLD: float = 0.05
    LOG_LEVEL: str = "INFO"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    QUERY_TIMEOUT_SECONDS: int = 30

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

@lru_cache
def get_settings() -> Settings:
    return Settings()
