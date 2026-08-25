from __future__ import annotations

import io
from pathlib import Path
from typing import Any
from uuid import UUID

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from .supabase_client import get_supabase_client
except ImportError:
    from supabase_client import get_supabase_client

try:
    from .repository import (
        get_dataset,
        get_dataset_insights,
        get_dataset_records,
        list_datasets,
        persistence_enabled,
        save_analysis,
    )
except ImportError:
    from repository import (
        get_dataset,
        get_dataset_insights,
        get_dataset_records,
        list_datasets,
        persistence_enabled,
        save_analysis,
    )

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ROWS = 100_000
REQUIRED_COLUMNS = {
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
}
NUMERIC_COLUMNS = {
    "area_acres",
    "yield_kg",
    "selling_price_per_kg",
    "total_cost",
    "rainfall_mm",
    "temperature_c",
    "production_kg",
    "soil_moisture_pct",
    "water_usage_liters",
    "seed_cost",
    "fertilizer_cost",
    "labor_cost",
    "transport_cost",
}

app = FastAPI(title="AgriInsight Analysis API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://localhost:8082"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_frame(filename: str, content: bytes) -> pd.DataFrame:
    if len(content) == 0:
        raise HTTPException(400, "This file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "Files must be smaller than 10 MB.")
    try:
        if filename.lower().endswith((".xlsx", ".xls")):
            return pd.read_excel(io.BytesIO(content))
        if filename.lower().endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(400, f"We could not read this file: {exc}") from exc
    raise HTTPException(415, "Upload a CSV or XLSX file.")


def validate_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frame.columns = [str(column).strip().lower() for column in frame.columns]
    missing = sorted(REQUIRED_COLUMNS - set(frame.columns))
    if missing:
        raise HTTPException(422, {"missing_columns": missing})
    if len(frame) == 0:
        raise HTTPException(422, "The file has column names but no records.")
    if len(frame) > MAX_ROWS:
        raise HTTPException(413, f"Files may contain at most {MAX_ROWS:,} rows.")

    errors: list[str] = []
    for column in NUMERIC_COLUMNS & set(frame.columns):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["record_date"] = pd.to_datetime(frame["record_date"], errors="coerce")
    for index, row in frame.iterrows():
        problems = []
        if pd.isna(row["record_date"]):
            problems.append("record_date is invalid")
        if not str(row["field_name"]).strip():
            problems.append("field_name is empty")
        if not str(row["crop_name"]).strip():
            problems.append("crop_name is empty")
        if pd.isna(row["area_acres"]) or row["area_acres"] <= 0:
            problems.append("area_acres must be greater than zero")
        for column in NUMERIC_COLUMNS & set(frame.columns):
            if pd.isna(row[column]) and column in REQUIRED_COLUMNS:
                problems.append(f"{column} is not a number")
        if problems and len(errors) < 12:
            errors.append(f"Row {index + 2}: {'; '.join(problems)}")
    if errors:
        raise HTTPException(422, {"invalid_rows": errors})
    return frame


def trend(frame: pd.DataFrame, value_column: str, mode: str = "mean") -> dict[str, Any]:
    values = frame[["record_date", value_column]].dropna().copy()
    if values.empty:
        return {
            "direction": "stable",
            "changePercent": None,
            "points": [],
            "bestPeriod": None,
            "worstPeriod": None,
        }
    values["period"] = values["record_date"].dt.strftime("%Y-%m")
    aggregation = values.groupby("period")[value_column].agg(mode).reset_index()
    points = [
        {"period": row.period, "value": round(float(getattr(row, value_column)), 2)}
        for row in aggregation.itertuples()
    ]
    first = points[0]["value"]
    last = points[-1]["value"]
    change = None if first == 0 else round(((last - first) / abs(first)) * 100, 1)
    direction = (
        "increasing"
        if change is not None and change > 5
        else "declining" if change is not None and change < -5 else "stable"
    )
    best = max(points, key=lambda point: point["value"])
    worst = min(points, key=lambda point: point["value"])
    return {
        "direction": direction,
        "changePercent": change,
        "points": points,
        "bestPeriod": best,
        "worstPeriod": worst,
    }


def iqr_anomalies(frame: pd.DataFrame) -> list[dict[str, Any]]:
    values = frame["yield_per_acre"].dropna()
    if len(values) < 6:
        return []
    q1 = float(values.quantile(0.25))
    q3 = float(values.quantile(0.75))
    spread = q3 - q1
    if spread == 0:
        return []
    low = q1 - (1.5 * spread)
    high = q3 + (1.5 * spread)
    result = []
    for index, row in frame.iterrows():
        value = float(row["yield_per_acre"])
        if value < low or value > high:
            boundary = "below" if value < low else "above"
            result.append(
                {
                    "rowId": int(index),
                    "field": str(row["field_name"]),
                    "crop": str(row["crop_name"]),
                    "date": row["record_date"].strftime("%Y-%m-%d"),
                    "value": round(value, 2),
                    "reason": f"{round(value)} kg per acre is {boundary} the normal range ({round(low)}-{round(high)} kg per acre).",
                }
            )
    return result


def build_insights(
    totals: dict[str, Any],
    by_crop: list[dict[str, Any]],
    by_field: list[dict[str, Any]],
    trends: dict[str, dict[str, Any]],
    anomalies: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []

    if anomalies:
        anomaly = anomalies[0]
        insights.append(
            {
                "id": "anomaly",
                "priority": "high",
                "title": f"{anomaly['field']} is outside its normal range",
                "observation": f"{anomaly['field']} recorded {anomaly['value']} kg per acre of {anomaly['crop']} on {anomaly['date']}.",
                "evidence": anomaly["reason"],
                "interpretation": "This record differs substantially from the other records in the dataset.",
                "action": f"Review irrigation and harvest records for {anomaly['field']} around {anomaly['date']}.",
                "sourceRows": [anomaly["rowId"]],
            }
        )

    yield_trend = trends.get("yieldPerAcre", {})
    if yield_trend.get("direction") in {"increasing", "declining"}:
        direction = yield_trend["direction"]
        change = abs(yield_trend.get("changePercent") or 0)
        falling = direction == "declining"
        insights.append(
            {
                "id": "yield-trend",
                "priority": "high" if falling else "low",
                "title": f"Yield per acre is {direction}",
                "observation": f"Average yield per acre changed by {change}% between the first and latest recorded periods.",
                "evidence": f"Best period: {yield_trend.get('bestPeriod', {}).get('period', 'unavailable')}; weakest period: {yield_trend.get('worstPeriod', {}).get('period', 'unavailable')}.",
                "interpretation": "The change may be related to differences in water, soil, inputs, weather, or harvest conditions.",
                "action": "Compare field, input, and weather records between the strongest and weakest periods.",
            }
        )

    if len(by_field) > 1:
        strongest = by_field[0]
        weakest = by_field[-1]
        insights.append(
            {
                "id": "field-gap",
                "priority": "medium",
                "title": f"{weakest['field_name'] if 'field_name' in weakest else weakest.get('name', 'One field')} needs a closer look",
                "observation": f"The strongest field averages {round(strongest['yield_per_acre'])} kg per acre, compared with {round(weakest['yield_per_acre'])} kg per acre for the weakest field.",
                "evidence": f"{strongest.get('name', strongest.get('field_name'))} ranks first and {weakest.get('name', weakest.get('field_name'))} ranks last by yield per acre.",
                "interpretation": "A difference between fields is a useful signal to compare local conditions and routines.",
                "action": f"Walk {weakest.get('name', weakest.get('field_name'))} and compare its soil and watering routine with {strongest.get('name', strongest.get('field_name'))}.",
            }
        )

    profitable_crops = [
        crop for crop in by_crop if crop.get("profit_per_acre") is not None
    ]
    if profitable_crops:
        best_crop = max(profitable_crops, key=lambda crop: crop["profit_per_acre"])
        crop_name = best_crop.get("name", best_crop.get("crop_name", "This crop"))
        insights.append(
            {
                "id": "crop-profit",
                "priority": "low",
                "title": f"{crop_name} returns the most per acre",
                "observation": f"{crop_name} returned ₹{round(best_crop['profit_per_acre']):,} per acre.",
                "evidence": f"Based on {round(best_crop['total_yield']):,} kg harvested across {best_crop['total_area']} acres.",
                "interpretation": "The recorded prices and costs currently favour this crop.",
                "action": "Keep this result in mind when reviewing your next sowing mix.",
            }
        )

    priority_order = {"high": 0, "medium": 1, "low": 2}
    return sorted(insights, key=lambda insight: priority_order[insight["priority"]])


def analyse(frame: pd.DataFrame) -> dict[str, Any]:
    frame = frame.copy()
    frame["production_kg"] = frame.get("production_kg", frame["yield_kg"]).fillna(
        frame["yield_kg"]
    )
    frame["yield_per_acre"] = frame["yield_kg"] / frame["area_acres"]
    frame["revenue"] = frame["production_kg"] * frame["selling_price_per_kg"]
    frame["profit"] = frame["revenue"] - frame["total_cost"]
    frame["profit_per_acre"] = frame["profit"] / frame["area_acres"]
    trends = {
        "yield": trend(frame, "yield_kg", "sum"),
        "rainfall": trend(frame, "rainfall_mm"),
        "temperature": trend(frame, "temperature_c"),
        "profit": trend(frame, "profit", "sum"),
        "profitPerAcre": trend(frame, "profit_per_acre"),
        "price": trend(frame, "selling_price_per_kg"),
        "yieldPerAcre": trend(frame, "yield_per_acre"),
    }
    anomalies = iqr_anomalies(frame)

    def groups(column: str) -> list[dict[str, Any]]:
        grouped = frame.groupby(column, as_index=False).agg(
            total_yield=("yield_kg", "sum"),
            total_area=("area_acres", "sum"),
            revenue=("revenue", "sum"),
            profit=("profit", "sum"),
            records=("yield_kg", "size"),
        )
        grouped["yield_per_acre"] = grouped["total_yield"] / grouped["total_area"]
        grouped["profit_per_acre"] = grouped["profit"] / grouped["total_area"]
        return grouped.sort_values("yield_per_acre", ascending=False).to_dict("records")

    evidence = frame.copy()
    evidence["record_date"] = evidence["record_date"].dt.strftime("%Y-%m-%d")
    evidence = evidence.where(pd.notna(evidence), None).to_dict("records")
    charts = {
        "yieldOverTime": trends["yield"]["points"],
        "rainfallOverTime": trends["rainfall"]["points"],
        "temperatureOverTime": trends["temperature"]["points"],
        "profitOverTime": trends["profit"]["points"],
        "sellingPriceOverTime": trends["price"]["points"],
        "yieldByField": [
            {"name": row["field_name"], "value": round(float(row["yield_per_acre"]), 2)}
            for row in frame.groupby("field_name")["yield_per_acre"]
            .mean()
            .reset_index()
            .to_dict("records")
        ],
        "yieldByCrop": [
            {"name": row["crop_name"], "value": round(float(row["yield_per_acre"]), 2)}
            for row in frame.groupby("crop_name")["yield_per_acre"]
            .mean()
            .reset_index()
            .to_dict("records")
        ],
    }
    totals = {
        "totalYield": float(frame["yield_kg"].sum()),
        "totalArea": float(frame["area_acres"].sum()),
        "avgYieldPerAcre": float(frame["yield_kg"].sum() / frame["area_acres"].sum()),
        "revenue": float(frame["revenue"].sum()),
        "profit": float(frame["profit"].sum()),
        "profitPerAcre": float(frame["profit"].sum() / frame["area_acres"].sum()),
        "fieldCount": int(frame["field_name"].nunique()),
        "cropCount": int(frame["crop_name"].nunique()),
        "latestDate": frame["record_date"].max().strftime("%Y-%m-%d"),
    }
    by_crop = groups("crop_name")
    by_field = groups("field_name")
    return {
        "totals": totals,
        "profile": {
            "rowCount": len(frame),
            "columnCount": len(frame.columns),
            "columns": list(frame.columns),
            "crops": sorted(frame["crop_name"].unique().tolist()),
            "fields": sorted(frame["field_name"].unique().tolist()),
            "seasons": sorted(frame["season"].unique().tolist()),
            "earliestDate": frame["record_date"].min().strftime("%Y-%m-%d"),
            "latestDate": frame["record_date"].max().strftime("%Y-%m-%d"),
        },
        "byCrop": by_crop,
        "byField": by_field,
        "trends": trends,
        "anomalies": anomalies,
        "charts": charts,
        "insights": build_insights(totals, by_crop, by_field, trends, anomalies),
        "evidence": evidence,
    }


def source_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records = frame.copy()
    records["record_date"] = records["record_date"].dt.strftime("%Y-%m-%d")
    return records.where(pd.notna(records), None).to_dict("records")


def persist_result(
    result: dict[str, Any],
    frame: pd.DataFrame,
    filename: str,
    content: bytes,
    source: str,
) -> dict[str, Any]:
    if not persistence_enabled():
        return result
    try:
        result["dataset_id"] = save_analysis(
            filename=filename,
            source=source,
            content=content,
            rows=source_records(frame),
            insights=result["insights"],
        )
    except Exception as exc:
        raise HTTPException(503, f"Supabase persistence failed: {exc}") from exc
    return result


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/database/check")
def database_check() -> dict[str, Any]:
    try:
        result = get_supabase_client().table("datasets").select("id").limit(1).execute()
    except Exception as exc:
        raise HTTPException(503, f"Supabase connection failed: {exc}") from exc
    return {"connected": True, "rows": result.data}


@app.get("/api/datasets")
def datasets() -> dict[str, Any]:
    try:
        return {"datasets": list_datasets()}
    except Exception as exc:
        raise HTTPException(503, f"Could not load datasets: {exc}") from exc


@app.get("/api/datasets/demo")
def demo_dataset() -> dict[str, Any]:
    template = (
        Path(__file__).resolve().parent.parent
        / "public"
        / "templates"
        / "agriinsight-template.csv"
    )
    try:
        content = template.read_bytes()
    except OSError as exc:
        raise HTTPException(500, "The demo dataset is not available.") from exc
    return analyse(validate_frame(read_frame(template.name, content)))


@app.get("/api/datasets/{dataset_id}")
def dataset(dataset_id: UUID) -> dict[str, Any]:
    dataset_key = str(dataset_id)
    try:
        result = get_dataset(dataset_key)
    except Exception as exc:
        raise HTTPException(503, f"Could not load dataset: {exc}") from exc
    if result is None:
        raise HTTPException(404, "Dataset not found")
    return result


@app.get("/api/datasets/{dataset_id}/records")
def dataset_records(dataset_id: UUID) -> dict[str, Any]:
    dataset_key = str(dataset_id)
    try:
        if get_dataset(dataset_key) is None:
            raise HTTPException(404, "Dataset not found")
        return {"records": get_dataset_records(dataset_key)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"Could not load dataset records: {exc}") from exc


@app.get("/api/datasets/{dataset_id}/insights")
def dataset_insights(dataset_id: UUID) -> dict[str, Any]:
    dataset_key = str(dataset_id)
    try:
        if get_dataset(dataset_key) is None:
            raise HTTPException(404, "Dataset not found")
        return {"insights": get_dataset_insights(dataset_key)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"Could not load dataset insights: {exc}") from exc


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read()
    frame = validate_frame(read_frame(file.filename or "upload.csv", content))
    filename = file.filename or "upload.csv"
    return persist_result(analyse(frame), frame, filename, content, "upload")
