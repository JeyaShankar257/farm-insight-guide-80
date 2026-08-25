import type {
  Analysis,
  Anomaly,
  EvidenceRow,
  FarmRecord,
  GroupPerformance,
  Trend,
  TrendDirection,
} from "@/types/dataset";
import { buildInsights } from "./insights";

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : null);

/** Adds every deterministic calculation to a source row. */
export function toEvidenceRows(rows: FarmRecord[]): EvidenceRow[] {
  const base = rows.map((row, index) => {
    const production = row.production_kg ?? row.yield_kg;
    const hasPrice = row.selling_price_per_kg > 0;
    const revenue = hasPrice && production > 0 ? production * row.selling_price_per_kg : null;
    const profit = revenue === null ? null : revenue - row.total_cost;
    return {
      ...row,
      id: `${row.record_date}-${row.field_name}-${row.crop_name}-${index}`,
      yield_per_acre: safeDivide(row.yield_kg, row.area_acres),
      revenue,
      profit,
      profit_per_acre: profit === null ? null : safeDivide(profit, row.area_acres),
      is_anomaly: false,
    } satisfies EvidenceRow;
  });

  const values = base.map((r) => r.yield_per_acre).filter((v): v is number => v !== null);
  const bounds = iqrBounds(values);
  if (!bounds) return base;

  return base.map((row) => {
    if (row.yield_per_acre === null) return row;
    if (row.yield_per_acre < bounds.low) {
      return {
        ...row,
        is_anomaly: true,
        anomaly_reason: `${Math.round(row.yield_per_acre)} kg per acre is below the normal range in this dataset (${Math.round(bounds.low)}–${Math.round(bounds.high)} kg per acre).`,
      };
    }
    if (row.yield_per_acre > bounds.high) {
      return {
        ...row,
        is_anomaly: true,
        anomaly_reason: `${Math.round(row.yield_per_acre)} kg per acre is above the normal range in this dataset (${Math.round(bounds.low)}–${Math.round(bounds.high)} kg per acre).`,
      };
    }
    return row;
  });
}

/** Explainable outlier detection using the interquartile range. */
function iqrBounds(values: number[]) {
  if (values.length < 6) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => {
    const pos = (sorted.length - 1) * q;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    const a = sorted[lower] ?? 0;
    const b = sorted[upper] ?? a;
    return a + (b - a) * (pos - lower);
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return null;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

function groupBy(rows: EvidenceRow[], key: "crop_name" | "field_name"): GroupPerformance[] {
  const buckets = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const name = row[key];
    const existing = buckets.get(name);
    if (existing) existing.push(row);
    else buckets.set(name, [row]);
  }

  return Array.from(buckets.entries())
    .map(([name, group]) => {
      const totalYield = sum(group.map((r) => r.yield_kg));
      const totalArea = sum(group.map((r) => r.area_acres));
      const revenueValues = group.map((r) => r.revenue).filter((v): v is number => v !== null);
      const profitValues = group.map((r) => r.profit).filter((v): v is number => v !== null);
      const revenue = revenueValues.length ? sum(revenueValues) : null;
      const profit = profitValues.length ? sum(profitValues) : null;
      return {
        name,
        totalYield,
        totalArea,
        yieldPerAcre: safeDivide(totalYield, totalArea),
        revenue,
        profit,
        profitPerAcre: profit === null ? null : safeDivide(profit, totalArea),
        records: group.length,
      };
    })
    .sort((a, b) => (b.yieldPerAcre ?? 0) - (a.yieldPerAcre ?? 0));
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function monthKey(date: string) {
  return date.slice(0, 7);
}

function buildTrend(
  rows: EvidenceRow[],
  metric: string,
  label: string,
  unit: string,
  pick: (row: EvidenceRow) => number | null,
  mode: "sum" | "avg",
): Trend {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const value = pick(row);
    if (value === null) continue;
    const key = monthKey(row.record_date);
    const list = buckets.get(key);
    if (list) list.push(value);
    else buckets.set(key, [value]);
  }

  const points = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]) => ({
      period,
      value:
        mode === "sum"
          ? Math.round(sum(values) * 100) / 100
          : Math.round((sum(values) / values.length) * 100) / 100,
    }));

  const first = points[0]?.value ?? null;
  const last = points[points.length - 1]?.value ?? null;
  let changePercent: number | null = null;
  let direction: TrendDirection = "stable";
  if (first !== null && last !== null && first !== 0) {
    changePercent = Math.round(((last - first) / Math.abs(first)) * 1000) / 10;
    direction = changePercent > 5 ? "increasing" : changePercent < -5 ? "declining" : "stable";
  }

  const sortedByValue = [...points].sort((a, b) => b.value - a.value);

  return {
    metric,
    label,
    unit,
    direction,
    changePercent,
    points,
    bestPeriod: sortedByValue[0] ?? null,
    worstPeriod: sortedByValue[sortedByValue.length - 1] ?? null,
  };
}

/** The single deterministic result the dashboard, evidence table and assistant all read. */
export function analyseDataset(rows: FarmRecord[]): Analysis {
  const evidence = toEvidenceRows(rows);
  const totalYield = sum(evidence.map((r) => r.yield_kg));
  const totalArea = sum(evidence.map((r) => r.area_acres));
  const revenueValues = evidence.map((r) => r.revenue).filter((v): v is number => v !== null);
  const profitValues = evidence.map((r) => r.profit).filter((v): v is number => v !== null);
  const revenue = revenueValues.length ? sum(revenueValues) : null;
  const profit = profitValues.length ? sum(profitValues) : null;

  const unavailable: string[] = [];
  if (revenue === null) unavailable.push("Estimated revenue needs selling price per kg.");
  if (profit === null) unavailable.push("Estimated profit needs selling price and total cost.");

  const byCrop = groupBy(evidence, "crop_name");
  const byField = groupBy(evidence, "field_name");

  const trends: Record<string, Trend> = {
    yield: buildTrend(evidence, "yield", "Yield", "kg", (r) => r.yield_kg, "sum"),
    yieldPerAcre: buildTrend(evidence, "yieldPerAcre", "Yield per acre", "kg/acre", (r) => r.yield_per_acre, "avg"),
    rainfall: buildTrend(evidence, "rainfall", "Rainfall", "mm", (r) => r.rainfall_mm, "avg"),
    temperature: buildTrend(evidence, "temperature", "Temperature", "°C", (r) => r.temperature_c, "avg"),
    profit: buildTrend(evidence, "profit", "Profit", "₹", (r) => r.profit, "sum"),
    profitPerAcre: buildTrend(
      evidence,
      "profitPerAcre",
      "Profit per acre",
      "₹/acre",
      (r) => r.profit_per_acre,
      "avg",
    ),
    price: buildTrend(evidence, "price", "Selling price", "₹/kg", (r) => r.selling_price_per_kg, "avg"),
  };

  const anomalies: Anomaly[] = evidence
    .filter((r) => r.is_anomaly)
    .map((r) => ({
      rowId: r.id,
      field: r.field_name,
      crop: r.crop_name,
      date: r.record_date,
      value: Math.round(r.yield_per_acre ?? 0),
      reason: r.anomaly_reason ?? "",
    }));

  const dates = evidence.map((r) => r.record_date).sort();

  const totals = {
    totalYield,
    totalArea,
    avgYieldPerAcre: safeDivide(totalYield, totalArea),
    revenue,
    profit,
    profitPerAcre: profit === null ? null : safeDivide(profit, totalArea),
    fieldCount: byField.length,
    cropCount: byCrop.length,
    latestDate: dates[dates.length - 1] ?? null,
  };

  return {
    totals,
    unavailable,
    evidence,
    byCrop,
    byField,
    trends,
    anomalies,
    insights: buildInsights({ totals, byCrop, byField, trends, anomalies }),
  };
}
