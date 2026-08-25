from __future__ import annotations

import os
from typing import Any
from pathlib import PurePosixPath
from uuid import uuid4

try:
    from .supabase_client import get_supabase_client
except ImportError:
    from supabase_client import get_supabase_client


def persistence_enabled() -> bool:
    return os.getenv("SUPABASE_PERSISTENCE_ENABLED", "false").lower() == "true"


def save_analysis(
    *,
    filename: str,
    source: str,
    content: bytes,
    rows: list[dict[str, Any]],
    insights: list[dict[str, Any]],
) -> str:
    client = get_supabase_client()
    dataset_id = str(uuid4())
    user_id = os.getenv("SUPABASE_DEFAULT_USER_ID") or None
    safe_filename = PurePosixPath(filename.replace("\\", "/")).name or "upload.csv"
    file_path = f"{user_id or 'anonymous'}/{dataset_id}/{safe_filename}"

    client.table("datasets").insert(
        {
            "id": dataset_id,
            "user_id": user_id,
            "name": filename,
            "source": source,
            "file_path": file_path,
            "row_count": len(rows),
        }
    ).execute()

    client.storage.from_(os.getenv("SUPABASE_STORAGE_BUCKET", "agri-datasets")).upload(
        file_path, content, {"content-type": _content_type(filename), "upsert": "false"}
    )

    records = [{"dataset_id": dataset_id, **_record(row)} for row in rows]
    if records:
        client.table("farm_records").insert(records).execute()

    insight_rows = [
        {
            "dataset_id": dataset_id,
            "priority": insight["priority"],
            "title": insight["title"],
            "observation": insight["observation"],
            "evidence": insight["evidence"],
            "interpretation": insight["interpretation"],
            "action": insight["action"],
        }
        for insight in insights
    ]
    if insight_rows:
        client.table("dataset_insights").insert(insight_rows).execute()
    return dataset_id


def list_datasets() -> list[dict[str, Any]]:
    response = (
        get_supabase_client()
        .table("datasets")
        .select("id,user_id,name,source,file_path,row_count,created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_dataset(dataset_id: str) -> dict[str, Any] | None:
    response = (
        get_supabase_client()
        .table("datasets")
        .select("id,user_id,name,source,file_path,row_count,created_at")
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def get_dataset_records(dataset_id: str) -> list[dict[str, Any]]:
    response = (
        get_supabase_client()
        .table("farm_records")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("record_date")
        .execute()
    )
    return response.data or []


def get_dataset_insights(dataset_id: str) -> list[dict[str, Any]]:
    response = (
        get_supabase_client()
        .table("dataset_insights")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("created_at")
        .execute()
    )
    return response.data or []


def _record(row: dict[str, Any]) -> dict[str, Any]:
    columns = {
        "record_date",
        "field_name",
        "crop_name",
        "area_acres",
        "yield_kg",
        "selling_price_per_kg",
        "total_cost",
        "rainfall_mm",
        "temperature_c",
        "season",
        "production_kg",
        "soil_moisture_pct",
        "water_usage_liters",
        "seed_cost",
        "fertilizer_cost",
        "labor_cost",
        "transport_cost",
    }
    return {
        column: row.get(column) for column in columns if row.get(column) is not None
    }


def _content_type(filename: str) -> str:
    return (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if filename.lower().endswith(".xlsx")
        else "text/csv"
    )
