from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "mstina-platform"
    app_env: str = "development"
    debug: bool = False
    database_url: str = "postgresql+psycopg://mstina:change_me@postgres:5432/mstina"
    postgres_db: str = "mstina"
    postgres_user: str = "mstina"
    postgres_password: str = "change_me"
    jwt_secret_key: str = "change-me-super-secret-key"
    jwt_algorithm: str = "HS256"
    #: Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
