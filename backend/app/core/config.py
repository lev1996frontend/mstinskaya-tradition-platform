from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: The shipped-in-source default. Fine for a laptop running against SQLite in
#: tests; a real deployment that never overrode it would sign every JWT with a
#: secret anyone can read on GitHub.
_DEFAULT_JWT_SECRET_KEY = "change-me-super-secret-key"


class Settings(BaseSettings):
    app_name: str = "mstina-platform"
    app_env: str = "development"
    debug: bool = False
    database_url: str = "postgresql+psycopg://mstina:change_me@postgres:5432/mstina"
    postgres_db: str = "mstina"
    postgres_user: str = "mstina"
    postgres_password: str = "change_me"
    jwt_secret_key: str = _DEFAULT_JWT_SECRET_KEY
    jwt_algorithm: str = "HS256"
    #: Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    #: Where uploaded documents are kept. A directory rather than a bucket for
    #: now; see docs/superpowers/specs/2026-09-07-files-architecture.md.
    upload_dir: str = "./var/uploads"
    #: The auth cookies' `Secure` flag. Off by default so the plain-HTTP dev
    #: server (browser talks to the Next.js proxy over http://localhost) can
    #: still receive them; a real deployment is HTTPS and must turn this on,
    #: which `env_cookie_secure_default` below does automatically once
    #: `app_env` says so, without needing its own line in every `.env`.
    cookie_secure: bool | None = None
    #: Resend API key. Unset in development/test on purpose — `EmailService`
    #: logs instead of sending for real when this is `None`, so neither local
    #: dev nor the test suite needs a real account.
    resend_api_key: str | None = None
    #: Must be a sender address on a domain verified in Resend, or delivery to
    #: anyone but the Resend account owner silently fails.
    email_from: str = "Мстинская традиция <onboarding@resend.dev>"
    #: Used to build links inside emails (e.g. the email-verification link) —
    #: the frontend's own origin, not this API's.
    frontend_base_url: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_cookie_secure(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.app_env not in {"development", "test"}

    @model_validator(mode="after")
    def _reject_default_secret_outside_dev(self) -> "Settings":
        if self.app_env not in {"development", "test"} and self.jwt_secret_key == _DEFAULT_JWT_SECRET_KEY:
            raise ValueError(
                "JWT_SECRET_KEY is still the placeholder default outside development/test — "
                "set a real secret in the environment before starting this app_env."
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
