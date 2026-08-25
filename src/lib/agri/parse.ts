import {
  OPTIONAL_COLUMNS,
  REQUIRED_COLUMNS,
  type FarmRecord,
  type ValidationIssue,
  type ValidationResult,
} from "@/types/dataset";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 100_000;

const NUMERIC_COLUMNS = new Set<string>([
  "area_acres",
  "yield_kg",
  "selling_price_per_kg",
  "total_cost",
  "rainfall_mm",
  "temperature_c",
  ...OPTIONAL_COLUMNS,
]);

/** Minimal RFC4180-ish CSV splitter (handles quoted fields and embedded commas). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Validates the canonical dataset structure and every row value. */
export function validateRecords(table: string[][]): ValidationResult {
  if (table.length === 0) {
    return {
      ok: false,
      issues: [{ kind: "file", message: "This file looks empty. Please add your farm records and try again." }],
    };
  }

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      issues: missing.map((column) => ({
        kind: "missing_column" as const,
        message: `Your file is missing the "${column}" column.`,
        ...(friendlyColumnHint(column) ? { detail: friendlyColumnHint(column)! } : {}),
      })),
    };
  }

  const body = table.slice(1);
  if (body.length === 0) {
    return {
      ok: false,
      issues: [{ kind: "file", message: "We found column names but no farm records underneath them." }],
    };
  }
  if (body.length > MAX_ROWS) {
    return {
      ok: false,
      issues: [
        {
          kind: "file",
          message: `This file has ${body.length.toLocaleString()} records. We can read up to ${MAX_ROWS.toLocaleString()} at a time.`,
        },
      ],
    };
  }

  const rows: FarmRecord[] = [];
  const issues: ValidationIssue[] = [];

  body.forEach((cells, index) => {
    const raw: Record<string, string> = {};
    header.forEach((key, i) => {
      raw[key] = (cells[i] ?? "").trim();
    });
    const get = (key: string) => raw[key] ?? "";

    const lineNumber = index + 2;
    const problems: string[] = [];

    if (!isValidDate(get("record_date"))) {
      problems.push('the date should look like 2024-10-12');
    }
    if (!get("field_name")) problems.push("the field name is empty");
    if (!get("crop_name")) problems.push("the crop name is empty");
    if (!get("season")) problems.push("the season is empty");

    const numbers: Record<string, number | undefined> = {};
    for (const key of Object.keys(raw)) {
      if (!NUMERIC_COLUMNS.has(key)) continue;
      if (get(key) === "") continue;
      const value = Number(get(key));
      if (Number.isNaN(value)) {
        problems.push(`"${get(key)}" in ${key} is not a number`);
      } else {
        numbers[key] = value;
      }
    }
    if (numbers["area_acres"] !== undefined && numbers["area_acres"] <= 0) {
      problems.push("the area in acres must be greater than zero");
    }

    if (problems.length > 0) {
      if (issues.length < 12) {
        issues.push({
          kind: "invalid_row",
          message: `Row ${lineNumber} was skipped`,
          detail: problems.join("; "),
        });
      }
      return;
    }

    rows.push({
      record_date: get("record_date"),
      field_name: get("field_name"),
      crop_name: get("crop_name"),
      season: get("season"),
      area_acres: numbers["area_acres"] ?? 0,
      yield_kg: numbers["yield_kg"] ?? 0,
      selling_price_per_kg: numbers["selling_price_per_kg"] ?? 0,
      total_cost: numbers["total_cost"] ?? 0,
      rainfall_mm: numbers["rainfall_mm"] ?? 0,
      temperature_c: numbers["temperature_c"] ?? 0,
      production_kg: numbers["production_kg"],
      soil_moisture_pct: numbers["soil_moisture_pct"],
      water_usage_liters: numbers["water_usage_liters"],
      seed_cost: numbers["seed_cost"],
      fertilizer_cost: numbers["fertilizer_cost"],
      labor_cost: numbers["labor_cost"],
      transport_cost: numbers["transport_cost"],
    });
  });

  if (rows.length === 0) {
    return {
      ok: false,
      issues: [
        { kind: "file", message: "None of the records in this file could be read." },
        ...issues,
      ],
    };
  }

  return { ok: true, rows, issues, columns: header };
}

function friendlyColumnHint(column: string) {
  const hints: Record<string, string> = {
    record_date: "The day the record was written down.",
    field_name: "The name you use for the field, for example Field B.",
    crop_name: "The crop grown, for example Rice.",
    area_acres: "How many acres the record covers.",
    yield_kg: "Harvested weight in kilograms.",
    selling_price_per_kg: "The price you sold at, per kilogram.",
    total_cost: "What that field cost you in total.",
    rainfall_mm: "Rainfall in millimetres.",
    temperature_c: "Average temperature in Celsius.",
    season: "The season name, for example Kharif 2024.",
  };
  return hints[column];
}

/** Reads an uploaded file into the canonical validation result. */
export async function readFarmFile(file: File): Promise<ValidationResult> {
  if (file.size === 0) {
    return { ok: false, issues: [{ kind: "file", message: "That file is empty." }] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      issues: [{ kind: "file", message: "That file is larger than 10 MB. Please split it into smaller files." }],
    };
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return {
      ok: false,
      issues: [
        {
          kind: "file",
          message: "Excel files are read by the analysis service, which is not connected yet.",
          detail: "For now, save your sheet as CSV (File → Save as → CSV) and upload it again.",
        },
      ],
    };
  }
  if (!name.endsWith(".csv")) {
    return {
      ok: false,
      issues: [{ kind: "file", message: "We can only read CSV files right now." }],
    };
  }

  try {
    const text = await file.text();
    return validateRecords(splitCsv(text));
  } catch {
    return {
      ok: false,
      issues: [{ kind: "file", message: "We could not read that file. Please check it opens in your spreadsheet app." }],
    };
  }
}
