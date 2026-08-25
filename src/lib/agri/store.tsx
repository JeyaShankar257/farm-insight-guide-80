import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Analysis,
  Dataset,
  DatasetFilters,
  FarmRecord,
  ValidationIssue,
} from "@/types/dataset";
import { analyseDataset } from "./analysis";
import { profileDataset } from "./profile";
import { splitCsv, validateRecords } from "./parse";
import { DEMO_CSV } from "./demo-data";

type DatasetContextValue = {
  dataset: Dataset | null;
  analysis: Analysis | null;
  filters: DatasetFilters;
  setFilters: (next: Partial<DatasetFilters>) => void;
  loadDemo: () => void;
  loadRows: (args: {
    rows: FarmRecord[];
    columns: string[];
    name: string;
    warnings: ValidationIssue[];
    analysis?: Analysis;
  }) => void;
  clear: () => void;
};

const emptyFilters: DatasetFilters = { crop: "all", field: "all", season: "all" };

const DatasetContext = createContext<DatasetContextValue | null>(null);

function buildDataset(
  rows: FarmRecord[],
  columns: string[],
  name: string,
  source: Dataset["source"],
  warnings: ValidationIssue[],
): Dataset {
  return {
    name,
    source,
    uploadedAt: new Date().toISOString(),
    rows,
    columns,
    profile: profileDataset(rows, columns),
    warnings,
  };
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [backendAnalysis, setBackendAnalysis] = useState<Analysis | null>(null);
  const [filters, setFiltersState] = useState<DatasetFilters>(emptyFilters);

  const loadDemo = useCallback(() => {
    const result = validateRecords(splitCsv(DEMO_CSV));
    if (!result.ok) return;
    setDataset(buildDataset(result.rows, result.columns, "Demo farm records", "demo", result.issues));
    setBackendAnalysis(null);
    setFiltersState(emptyFilters);
  }, []);

  const loadRows = useCallback<DatasetContextValue["loadRows"]>(
    ({ rows, columns, name, warnings, analysis: nextAnalysis }) => {
      setDataset(buildDataset(rows, columns, name, "upload", warnings));
      setBackendAnalysis(nextAnalysis ?? null);
      setFiltersState(emptyFilters);
    },
    [],
  );

  const setFilters = useCallback((next: Partial<DatasetFilters>) => {
    setFiltersState((current) => ({ ...current, ...next }));
  }, []);

  const clear = useCallback(() => {
    setDataset(null);
    setBackendAnalysis(null);
    setFiltersState(emptyFilters);
  }, []);

  const analysis = useMemo(() => {
    if (!dataset) return null;
    const rows = dataset.rows.filter(
      (row) =>
        (filters.crop === "all" || row.crop_name === filters.crop) &&
        (filters.field === "all" || row.field_name === filters.field) &&
        (filters.season === "all" || row.season === filters.season),
    );
    if (rows.length === 0) return backendAnalysis ?? analyseDataset(dataset.rows);
    return analyseDataset(rows);
  }, [backendAnalysis, dataset, filters]);

  const value = useMemo(
    () => ({ dataset, analysis, filters, setFilters, loadDemo, loadRows, clear }),
    [dataset, analysis, filters, setFilters, loadDemo, loadRows, clear],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (!context) throw new Error("useDataset must be used inside DatasetProvider");
  return context;
}
