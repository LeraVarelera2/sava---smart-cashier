import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, URL


ML_ROOT = Path(__file__).resolve().parents[1]


def load_environment() -> None:
    env_file = ML_ROOT / ".env"
    if not env_file.is_file():
        return

    for line in env_file.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if not value or value.startswith("#") or "=" not in value:
            continue
        key, raw_value = value.split("=", 1)
        os.environ.setdefault(key.strip(), raw_value.strip().strip("\"'"))


def create_database_engine() -> Engine:
    load_environment()
    required = ("DB_HOST", "DB_DATABASE", "DB_USERNAME")
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise RuntimeError("Konfigurasi database belum lengkap: " + ", ".join(missing))

    url = URL.create(
        "postgresql+psycopg2",
        username=os.environ["DB_USERNAME"],
        password=os.getenv("DB_PASSWORD", ""),
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.environ["DB_DATABASE"],
    )
    return create_engine(url, pool_pre_ping=True)
