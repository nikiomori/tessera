"""Runtime configuration loaded from environment variables."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TESSERA_", env_file=".env", extra="ignore")

    api_key: str | None = None
    # Disabled by default — fits self-host. Set a positive value (e.g. 120) for
    # public-facing deploys where you want per-IP throttling.
    rate_limit_per_min: int = 0
    static_dir: str | None = None
    cors_origins: str = "*"
    max_batch_items: int = Field(default=200, ge=1, le=10_000)

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
