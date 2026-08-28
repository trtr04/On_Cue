from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(PROJECT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    zhipu_api_url: str = os.getenv(
        "ZHIPU_API_URL",
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    )
    zhipu_api_key: str = os.getenv("ZHIPU_API_KEY", "")
    zhipu_model: str = os.getenv("ZHIPU_MODEL", "glm-4-flash-250414")
    zhipu_fallback_models: str = os.getenv("ZHIPU_FALLBACK_MODELS", "glm-4.7-flash")
    zhipu_timeout_seconds: float = float(os.getenv("ZHIPU_TIMEOUT_SECONDS", "30"))
    tencent_app_id: str = os.getenv("TENCENT_APP_ID", "")
    tencent_secret_id: str = os.getenv("TENCENT_SECRET_ID", "")
    tencent_secret_key: str = os.getenv("TENCENT_SECRET_KEY", "")
    tencent_asr_engine: str = os.getenv("TENCENT_ASR_ENGINE", "16k_zh")
    tencent_asr_timeout_seconds: float = float(os.getenv("TENCENT_ASR_TIMEOUT_SECONDS", "30"))
    tencent_asr_poll_timeout_seconds: float = float(
        os.getenv("TENCENT_ASR_POLL_TIMEOUT_SECONDS", "60")
    )
    database_path: Path = Path(
        os.getenv("DATABASE_PATH", str(PROJECT_DIR / "data" / "classic_training.db"))
    ).expanduser()

    @property
    def llm_enabled(self) -> bool:
        return bool(self.zhipu_api_url and self.zhipu_api_key and self.zhipu_model)

    @property
    def transcription_enabled(self) -> bool:
        return bool(self.tencent_app_id and self.tencent_secret_id and self.tencent_secret_key)

    @property
    def zhipu_models(self) -> list[str]:
        ordered = [self.zhipu_model]
        ordered.extend(model.strip() for model in self.zhipu_fallback_models.split(",") if model.strip())
        return list(dict.fromkeys(ordered))


settings = Settings()
