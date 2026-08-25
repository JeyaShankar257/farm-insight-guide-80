from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parent / ".env")


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    project_id = os.getenv("SUPABASE_PROJECT_ID", "").strip()
    if not url and project_id:
        if not project_id.replace("-", "").isalnum():
            raise RuntimeError("SUPABASE_PROJECT_ID contains invalid characters")
        url = f"https://{project_id}.supabase.co"
    key = (
        os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
    ).strip()

    if not url.startswith("https://") or not url.endswith(".supabase.co"):
        raise RuntimeError(
            "SUPABASE_URL must be the project URL, for example https://project-id.supabase.co"
        )
    if not key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured"
        )
    if key.startswith("sb_publishable_"):
        raise RuntimeError(
            "A publishable key cannot be used by the backend; configure SUPABASE_SECRET_KEY"
        )

    return create_client(url, key)
