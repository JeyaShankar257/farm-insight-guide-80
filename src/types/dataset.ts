/** Canonical AgriInsight dataset contract shared by every feature. */

export const REQUIRED_COLUMNS = [
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
] as const;

export const OPTIONAL_COLUMNS = [
  "production_kg",
  "soil_moisture_pct",
  "water_usage_liters",
  "seed_cost",
  "fertilizer_cost",
  "labor_cost",
  "transport_cost",
] as const;

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

/** A validated source row, exactly as the farmer supplied it. */
export type FarmRecord = {
  record_date: string;
  field_name: string;
  crop_name: string;
  area_acres: number;
  yield_kg: number;
  selling_price_per_kg: number;
  total_cost: number;
  rainfall_mm: number;
  temperature_c: number;
  season: string;
  production_kg?: number | undefined;
  soil_moisture_pct?: number | undefined;
  water_usage_liters?: number | undefined;
  seed_cost?: number | undefined;
  fertilizer_cost?: number | undefined;
  labor_cost?: number | undefined;
  transport_cost?: number | undefined;
};

/** A source row plus every deterministically computed value. */
export type EvidenceRow = FarmRecord & {
  id: string;
  yield_per_acre: number | null;
  revenue: number | null;
  profit: number | null;
  profit_per_acre: number | null;
  is_anomaly: boolean;
  anomaly_reason?: string | undefined;
};

export type DatasetProfile = {
  rowCount: number;
  columnCount: number;
  columns: string[];
  types: Record<string, "date" | "text" | "number">;
  nullCounts: Record<string, number>;
  nullPercent: Record<string, number>;
  samples: Record<string, string>;
  crops: string[];
  fields: string[];
  seasons: string[];
  earliestDate: string | null;
  latestDate: string | null;
  warnings: string[];
};

export type ValidationIssue = {
  kind: "missing_column" | "invalid_row" | "file";
  message: string;
  detail?: string | undefined;
};

export type ValidationResult =
  | { ok: true; rows: FarmRecord[]; issues: ValidationIssue[]; columns: string[] }
  | { ok: false; issues: ValidationIssue[] };

export type Dataset = {
  name: string;
  source: "demo" | "upload";
  uploadedAt: string;
  rows: FarmRecord[];
  columns: string[];
  profile: DatasetProfile;
  warnings: ValidationIssue[];
};

export type TrendDirection = "increasing" | "declining" | "stable";

export type Trend = {
  metric: string;
  label: string;
  unit: string;
  direction: TrendDirection;
  changePercent: number | null;
  points: { period: string; value: number }[];
  bestPeriod: { period: string; value: number } | null;
  worstPeriod: { period: string; value: number } | null;
};

export type GroupPerformance = {
  name: string;
  totalYield: number;
  totalArea: number;
  yieldPerAcre: number | null;
  revenue: number | null;
  profit: number | null;
  profitPerAcre: number | null;
  records: number;
};

export type Anomaly = {
  rowId: string;
  field: string;
  crop: string;
  date: string;
  value: number;
  reason: string;
};

export type Insight = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  observation: string;
  evidence: string;
  interpretation: string;
  action: string;
};

export type Analysis = {
  totals: {
    totalYield: number;
    totalArea: number;
    avgYieldPerAcre: number | null;
    revenue: number | null;
    profit: number | null;
    profitPerAcre: number | null;
    fieldCount: number;
    cropCount: number;
    latestDate: string | null;
  };
  unavailable: string[];
  evidence: EvidenceRow[];
  byCrop: GroupPerformance[];
  byField: GroupPerformance[];
  trends: Record<string, Trend>;
  anomalies: Anomaly[];
  insights: Insight[];
};

export type DatasetFilters = {
  crop: string;
  field: string;
  season: string;
};
