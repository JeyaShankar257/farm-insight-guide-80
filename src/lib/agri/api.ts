import type { Analysis, DatasetProfile, EvidenceRow, GroupPerformance, Insight, Trend } from "@/types/dataset";

const API_URL = import.meta.env["VITE_BACKEND_URL"] ?? "http://localhost:8000";

type BackendGroup = {
  [key: string]: string | number;
  total_yield: number;
  total_area: number;
  revenue: number;
  profit: number;
  records: number;
  yield_per_acre: number;
  profit_per_acre: number;
};

type BackendResponse = {
  totals: Analysis["totals"];
  profile: {
    rowCount: number;
    columnCount: number;
    columns: string[];
    crops: string[];
    fields: string[];
    seasons: string[];
    earliestDate: string;
    latestDate: string;
  };
  byCrop: BackendGroup[];
  byField: BackendGroup[];
  trends: Record<string, Omit<Trend, "metric" | "label" | "unit">>;
  anomalies: Analysis["anomalies"];
  evidence: EvidenceRow[];
  insights: Insight[];
};

function groups(rows: BackendGroup[], nameKey: "crop_name" | "field_name"): GroupPerformance[] {
  return rows.map((row) => ({
    name: String(row[nameKey]),
    totalYield: Number(row.total_yield),
    totalArea: Number(row.total_area),
    yieldPerAcre: Number(row.yield_per_acre),
    revenue: Number(row.revenue),
    profit: Number(row.profit),
    profitPerAcre: Number(row.profit_per_acre),
    records: Number(row.records),
  }));
}

function profile(data: BackendResponse["profile"]): DatasetProfile {
  return {
    ...data,
    types: {},
    nullCounts: {},
    nullPercent: {},
    samples: {},
    warnings: [],
  };
}

async function responseToResult(response: Response): Promise<{ analysis: Analysis; profile: DatasetProfile }> {
  const raw = (await response.json()) as BackendResponse | { detail?: string | Record<string, string[]> };
  if (!response.ok) {
    const detail = "detail" in raw ? raw.detail : "The analysis service could not read this file.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const payload = raw as BackendResponse;
  return {
    profile: profile(payload.profile),
    analysis: {
      totals: payload.totals,
      unavailable: [],
      evidence: payload.evidence,
      byCrop: groups(payload.byCrop, "crop_name"),
      byField: groups(payload.byField, "field_name"),
      trends: Object.fromEntries(Object.entries(payload.trends).map(([key, value]) => [key, { ...value, metric: key, label: key, unit: "" }])),
      anomalies: payload.anomalies,
      insights: payload.insights,
    },
  };
}

export async function uploadToBackend(file: File): Promise<{ analysis: Analysis; profile: DatasetProfile }> {
  const body = new FormData();
  body.append("file", file);
  return responseToResult(await fetch(`${API_URL}/api/datasets/upload`, { method: "POST", body }));
}

export async function loadDemoFromBackend(): Promise<{ analysis: Analysis; profile: DatasetProfile }> {
  return responseToResult(await fetch(`${API_URL}/api/datasets/demo`));
}
