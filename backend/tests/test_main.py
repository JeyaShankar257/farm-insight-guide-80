from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from backend.main import app, analyse, validate_frame

client = TestClient(app)
TEMPLATE = (
    Path(__file__).resolve().parents[2]
    / "public"
    / "templates"
    / "agriinsight-template.csv"
)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_csv_upload_returns_analysis() -> None:
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("farm.csv", TEMPLATE.read_bytes(), "text/csv")},
    )
    payload = response.json()
    assert response.status_code == 200
    assert payload["profile"]["rowCount"] == 2
    assert payload["totals"]["profitPerAcre"] > 0
    assert "charts" in payload
    assert "insights" in payload


def test_xlsx_upload_returns_analysis() -> None:
    frame = pd.read_csv(TEMPLATE)
    workbook = BytesIO()
    frame.to_excel(workbook, index=False)
    response = client.post(
        "/api/datasets/upload",
        files={
            "file": (
                "farm.xlsx",
                workbook.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 200
    assert response.json()["profile"]["rowCount"] == 2


def test_missing_columns_are_reported() -> None:
    response = client.post(
        "/api/datasets/upload",
        files={
            "file": (
                "farm.csv",
                b"record_date,field_name\n2024-01-01,Field A\n",
                "text/csv",
            )
        },
    )
    assert response.status_code == 422
    assert "missing_columns" in response.json()["detail"]


def test_demo_endpoint_uses_template() -> None:
    response = client.get("/api/datasets/demo")
    assert response.status_code == 200
    assert response.json()["profile"]["rowCount"] == 2


def test_analysis_detects_anomaly_and_builds_insight() -> None:
    frame = pd.DataFrame(
        [
            {
                "record_date": f"2024-0{i}-01",
                "field_name": "Field A",
                "crop_name": "Rice",
                "area_acres": 1,
                "yield_kg": value,
                "selling_price_per_kg": 10,
                "total_cost": 100,
                "rainfall_mm": 50,
                "temperature_c": 25,
                "season": "Rabi",
            }
            for i, value in enumerate([100, 110, 105, 95, 100, 1000], start=1)
        ]
    )
    result = analyse(validate_frame(frame))
    assert len(result["anomalies"]) == 1
    assert result["anomalies"][0]["value"] == 1000
    assert any(
        insight["id"] == "anomaly" and insight["priority"] == "high"
        for insight in result["insights"]
    )
