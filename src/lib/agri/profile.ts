import { OPTIONAL_COLUMNS, type DatasetProfile, type FarmRecord } from "@/types/dataset";

const NUMERIC = new Set<string>([
  "area_acres",
  "yield_kg",
  "selling_price_per_kg",
  "total_cost",
  "rainfall_mm",
  "temperature_c",
  ...OPTIONAL_COLUMNS,
]);

/** Builds the dataset profile the data-quality view reads from. */
export function profileDataset(rows: FarmRecord[], columns: string[]): DatasetProfile {
  const types: DatasetProfile["types"] = {};
  const nullCounts: Record<string, number> = {};
  const nullPercent: Record<string, number> = {};
  const samples: Record<string, string> = {};

  for (const column of columns) {
    types[column] = column === "record_date" ? "date" : NUMERIC.has(column) ? "number" : "text";
    let nulls = 0;
    let sample = "";
    for (const row of rows) {
      const value = (row as unknown as Record<string, unknown>)[column];
      if (value === undefined || value === null || value === "") nulls++;
      else if (!sample) sample = String(value);
    }
    nullCounts[column] = nulls;
    nullPercent[column] = rows.length ? Math.round((nulls / rows.length) * 1000) / 10 : 0;
    samples[column] = sample;
  }

  const dates = rows.map((r) => r.record_date).sort();
  const unique = (values: string[]) => Array.from(new Set(values)).sort();

  const warnings: string[] = [];
  if (!columns.includes("production_kg")) {
    warnings.push("No production_kg column, so revenue and profit are estimated from harvested yield.");
  }
  for (const column of columns) {
    if ((nullPercent[column] ?? 0) > 20) {
      warnings.push(`${column} is empty in ${nullPercent[column]}% of records.`);
    }
  }

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    types,
    nullCounts,
    nullPercent,
    samples,
    crops: unique(rows.map((r) => r.crop_name)),
    fields: unique(rows.map((r) => r.field_name)),
    seasons: unique(rows.map((r) => r.season)),
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    warnings,
  };
}
