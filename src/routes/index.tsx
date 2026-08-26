import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileUp,
  Leaf,
  RefreshCw,
  Sprout,
  UploadCloud,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ReferenceDot,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatasetProvider, useDataset } from "@/lib/agri/store";
import { loadDemoFromBackend, uploadToBackend } from "@/lib/agri/api";
import type { Analysis, Trend } from "@/types/dataset";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <FarmWorkspace />;
}

function FarmWorkspace() {
  const { dataset, analysis, loadDemo, loadRows, clear, filters, setFilters } = useDataset();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showBackendResult(result: Awaited<ReturnType<typeof uploadToBackend>>, name: string) {
    loadRows({
      rows: result.analysis.evidence.map(
        ({ id: _id, yield_per_acre: _yieldPerAcre, revenue: _revenue, profit: _profit, profit_per_acre: _profitPerAcre, is_anomaly: _isAnomaly, anomaly_reason: _anomalyReason, ...row }) => row,
      ),
      columns: result.profile.columns,
      name,
      warnings: [],
      analysis: result.analysis,
    });
  }

  async function handleDemo() {
    setUploading(true);
    setError(null);
    try {
      showBackendResult(await loadDemoFromBackend(), "Demo farm records");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The analysis service could not load the demo data.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadToBackend(file);
      showBackendResult(result, file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The analysis service could not read this file.");
    } finally {
      setUploading(false);
    }
  }

  if (!dataset || !analysis) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,oklch(0.93_0.08_80),transparent_35%),linear-gradient(135deg,var(--background),oklch(0.96_0.03_145))] px-5 py-8 text-foreground sm:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-12">
          <header className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground">
              <Sprout size={22} />
            </div>
            <span className="font-serif text-xl font-semibold">AgriInsight</span>
          </header>
          <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div className="max-w-xl">
              <p className="kpi-label text-primary">Your farm, in focus</p>
              <h1 className="mt-3 text-5xl font-semibold leading-[1.02] sm:text-7xl">
                Know what to look at first.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Turn your harvest records into clear field performance, trends, and practical next
                steps.
              </p>
            </div>
            <Card className="border-primary/15 shadow-xl shadow-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <UploadCloud className="text-primary" /> Bring in your records
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use the prepared farm or upload a CSV file to begin.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="h-12 w-full gap-2" disabled={uploading} onClick={() => void handleDemo()}>
                  <Leaf size={18} /> Explore demo farm
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full gap-2"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileUp size={18} /> {uploading ? "Reading your file..." : "Upload CSV"}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}
                <a
                  className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href="/templates/agriinsight-template.csv"
                  download
                >
                  Download the CSV template
                </a>
                <p className="text-center text-xs text-muted-foreground">
                  CSV or XLSX · up to 10 MB · required columns included in the template
                </p>
              </CardContent>
            </Card>
          </section>
          <p className="text-sm text-muted-foreground">
            Numbers are calculated from your records. Recommendations are prompts for review, not
            guaranteed agronomic advice.
          </p>
        </div>
      </main>
    );
  }

  return (
    <Dashboard
      analysis={analysis}
      datasetName={dataset.name}
      filters={filters}
      setFilters={setFilters}
      clear={clear}
    />
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-lg shadow-black/10 text-sm min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: entry.color ?? "var(--harvest-green)" }}
            />
            {entry.name}
          </span>
          <span className="font-semibold text-foreground">
            {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({
  analysis,
  datasetName,
  filters,
  setFilters,
  clear,
}: {
  analysis: Analysis;
  datasetName: string;
  filters: { crop: string; field: string; season: string };
  setFilters: (next: Partial<typeof filters>) => void;
  clear: () => void;
}) {
  const trend = analysis.trends["yieldPerAcre"];
  const profitTrend = analysis.trends["profitPerAcre"];

  const money = (value: number | null) =>
    value === null ? "Unavailable" : `₹${Math.round(value).toLocaleString("en-IN")}`;
  const number = (value: number | null, suffix = "") =>
    value === null ? "Unavailable" : `${Math.round(value).toLocaleString("en-IN")}${suffix}`;

  // Profit margin %
  const profitMarginPct =
    analysis.totals.revenue && analysis.totals.profit !== null && analysis.totals.revenue > 0
      ? (analysis.totals.profit / analysis.totals.revenue) * 100
      : null;

  // Deltas from trends (first → last point change %)
  function trendDelta(t: Trend | undefined): number | null {
    if (!t || !t.points.length || t.changePercent === null) return null;
    return t.direction === "increasing"
      ? Math.abs(t.changePercent)
      : t.direction === "declining"
        ? -Math.abs(t.changePercent)
        : 0;
  }

  const yieldDelta = trendDelta(trend);
  const profitDelta = trendDelta(profitTrend);

  // Radar chart data: normalise each metric 0–100 across crops
  const radarMetrics = ["yieldPerAcre", "profitPerAcre", "revenue"] as const;
  const radarMax: Record<string, number> = {};
  for (const m of radarMetrics) {
    radarMax[m] = Math.max(1, ...analysis.byCrop.map((c) => (c[m] ?? 0)));
  }
  const radarData = radarMetrics.map((m) => ({
    metric: m === "yieldPerAcre" ? "Yield/acre" : m === "profitPerAcre" ? "Profit/acre" : "Revenue",
    ...Object.fromEntries(
      analysis.byCrop.map((c) => [c.name, (((c[m] ?? 0) / (radarMax[m] ?? 1)) * 100)])
    ),
  }));

  // Scatter: rainfall vs yield, one dot per evidence row
  const scatterData = analysis.evidence
    .filter((r) => r.rainfall_mm != null && r.yield_per_acre != null)
    .map((r) => ({
      x: r.rainfall_mm,
      y: r.yield_per_acre ?? 0,
      z: r.area_acres,
      name: r.crop_name,
    }));

  // Stacked cost breakdown by crop
  const costFields = [
    { key: "seed_cost", label: "Seed", color: "var(--harvest-green)" },
    { key: "fertilizer_cost", label: "Fertilizer", color: "var(--harvest-gold)" },
    { key: "labor_cost", label: "Labor", color: "var(--rain)" },
    { key: "transport_cost", label: "Transport", color: "var(--good)" },
  ] as const;
  const hasCostData = analysis.evidence.some((r) =>
    costFields.some((f) => r[f.key] != null && (r[f.key] as number) > 0),
  );
  const costByCrop = analysis.byCrop.map((crop) => {
    const rows = analysis.evidence.filter((r) => r.crop_name === crop.name);
    const entry: Record<string, string | number> = { name: crop.name };
    for (const f of costFields) {
      const total = rows.reduce((sum, r) => sum + ((r[f.key] as number | undefined) ?? 0), 0);
      entry[f.label] = Math.round(total);
    }
    return entry;
  });

  // Anomaly reference dots on yield chart
  const anomalyPeriods = new Set(
    analysis.anomalies.map((a) => {
      const d = new Date(a.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }),
  );
  const yieldPointsWithAnomalies = (trend?.points ?? []).map((p) => ({
    ...p,
    isAnomaly: anomalyPeriods.has(p.period),
  }));

  const CROP_COLORS = [
    "var(--harvest-green)",
    "var(--harvest-gold)",
    "var(--rain)",
    "var(--good)",
    "oklch(0.5 0.08 265)",
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground">
              <Sprout size={22} />
            </div>
            <div>
              <p className="font-serif text-2xl font-semibold">AgriInsight</p>
              <p className="text-sm text-muted-foreground">{datasetName}</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={clear}>
            <RefreshCw size={16} /> New dataset
          </Button>
        </header>

        {/* Hero banner */}
        <section className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/15 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm uppercase tracking-widest opacity-75">Farm snapshot</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
                Here is where your attention can go.
              </h1>
            </div>
            <p className="text-sm opacity-80">
              Latest records: {analysis.totals.latestDate ?? "-"}
            </p>
          </div>
        </section>

        {/* KPI cards – 5 columns */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Total yield"
            value={number(analysis.totals.totalYield, " kg")}
            icon={<Leaf />}
          />
          <Metric
            label="Avg yield / acre"
            value={number(analysis.totals.avgYieldPerAcre, " kg")}
            icon={<ArrowUpRight />}
            delta={yieldDelta}
          />
          <Metric
            label="Estimated revenue"
            value={money(analysis.totals.revenue)}
            icon={<span>₹</span>}
          />
          <Metric
            label="Estimated profit"
            value={money(analysis.totals.profit)}
            icon={<span>+</span>}
            delta={profitDelta}
          />
          <Metric
            label="Profit margin"
            value={profitMarginPct !== null ? `${profitMarginPct.toFixed(1)}%` : "Unavailable"}
            icon={<TrendingUp />}
            delta={profitDelta}
            {...(profitMarginPct !== null
              ? {
                highlight:
                  profitMarginPct >= 20
                    ? ("good" as const)
                    : profitMarginPct >= 5
                      ? ("warn" as const)
                      : ("bad" as const),
              }
              : {})}
          />
        </div>

        {/* Filters */}
        <section className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
          <Filter
            label="Crop"
            value={filters.crop}
            options={analysis.byCrop.map((item) => item.name)}
            onChange={(crop) => setFilters({ crop })}
          />
          <Filter
            label="Field"
            value={filters.field}
            options={analysis.byField.map((item) => item.name)}
            onChange={(field) => setFilters({ field })}
          />
          <Filter
            label="Season"
            value={filters.season}
            options={Array.from(new Set(analysis.evidence.map((item) => item.season)))}
            onChange={(season) => setFilters({ season })}
          />
        </section>

        {/* Yield trend + Field comparison */}
        <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          {/* Yield trend area chart with anomaly markers */}
          <Card>
            <CardHeader>
              <CardTitle>Yield per acre</CardTitle>
              <p className="text-sm text-muted-foreground">
                {trend?.direction === "stable"
                  ? "Holding steady"
                  : `${trend?.direction} by ${Math.abs(trend?.changePercent ?? 0)}%`}{" "}
                across your recorded months
                {analysis.anomalies.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-harvest-gold-soft px-2 py-0.5 text-xs text-harvest-gold font-medium">
                    ● {analysis.anomalies.length} anomaly{analysis.anomalies.length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yieldPointsWithAnomalies}>
                    <defs>
                      <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--harvest-green)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--harvest-green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis width={45} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v, n) => `${Math.round(v).toLocaleString("en-IN")} kg`}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Yield/acre"
                      stroke="var(--harvest-green)"
                      fill="url(#yieldFill)"
                      strokeWidth={3}
                    />
                    {yieldPointsWithAnomalies
                      .filter((p) => p.isAnomaly)
                      .map((p) => (
                        <ReferenceDot
                          key={p.period}
                          x={p.period}
                          y={p.value}
                          r={7}
                          fill="var(--harvest-gold)"
                          stroke="white"
                          strokeWidth={2}
                          label={{ value: "!", position: "top", fontSize: 11, fontWeight: 700, fill: "var(--harvest-gold)" }}
                        />
                      ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Field comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Field comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.byField.map((field, index) => (
                <div key={field.name}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate">
                      {index + 1}. {field.name}
                    </span>
                    <strong>{number(field.yieldPerAcre, " kg/ac")}</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-harvest-gold transition-all duration-700"
                      style={{
                        width: `${Math.min(100, ((field["yieldPerAcre"] ?? 0) / (analysis.byField[0]?.["yieldPerAcre"] || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Crop Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Crop performance radar</CardTitle>
            <p className="text-sm text-muted-foreground">
              Multi-metric comparison of crops — yield, profit, and revenue normalised to 0–100
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {analysis.byCrop.map((crop, i) => (
                    <Radar
                      key={crop.name}
                      name={crop.name}
                      dataKey={crop.name}
                      stroke={CROP_COLORS[i % CROP_COLORS.length]}
                      fill={CROP_COLORS[i % CROP_COLORS.length]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    content={
                      <CustomTooltip formatter={(v) => `${Math.round(v)}%`} />
                    }
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rainfall vs Yield Scatter */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rainfall vs Yield correlation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Each dot is one harvest record. Bubble size = area (acres).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Rainfall"
                      unit=" mm"
                      tickLine={false}
                      axisLine={false}
                      label={{ value: "Rainfall (mm)", position: "insideBottom", offset: -4, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Yield/acre"
                      unit=" kg"
                      width={50}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZAxis type="number" dataKey="z" range={[30, 200]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const entry = payload[0];
                        const d = entry?.payload as { x: number; y: number; z: number; name: string } | undefined;
                        if (!d) return null;
                        return (
                          <div className="rounded-xl border bg-card px-4 py-3 shadow-lg text-sm">
                            <p className="font-semibold mb-1">{d.name}</p>
                            <p className="text-muted-foreground">Rainfall: <strong className="text-foreground">{d.x} mm</strong></p>
                            <p className="text-muted-foreground">Yield/acre: <strong className="text-foreground">{Math.round(d.y).toLocaleString("en-IN")} kg</strong></p>
                            <p className="text-muted-foreground">Area: <strong className="text-foreground">{d.z} ac</strong></p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      name="Records"
                      data={scatterData}
                      fill="var(--rain)"
                      fillOpacity={0.65}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cost breakdown stacked bar */}
          <Card>
            <CardHeader>
              <CardTitle>Cost breakdown by crop</CardTitle>
              <p className="text-sm text-muted-foreground">
                {hasCostData
                  ? "Total costs split by category across all records"
                  : "No detailed cost data found — add seed/fertilizer/labor/transport columns to your CSV"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {hasCostData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costByCrop} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis width={48} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={
                          <CustomTooltip
                            formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                          />
                        }
                      />
                      <Legend />
                      {costFields.map((f) => (
                        <Bar key={f.label} dataKey={f.label} stackId="a" fill={f.color} radius={[0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg bg-muted/40">
                    <p className="text-sm text-muted-foreground text-center px-6">
                      Upload a CSV with <code className="rounded bg-muted px-1">seed_cost</code>,{" "}
                      <code className="rounded bg-muted px-1">fertilizer_cost</code>,{" "}
                      <code className="rounded bg-muted px-1">labor_cost</code> columns to see this chart.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TrendCard title="Rainfall trend" trend={analysis.trends["rainfall"]} color="var(--rain)" unit=" mm" />
          <TrendCard
            title="Temperature trend"
            trend={analysis.trends["temperature"]}
            color="var(--harvest-gold)"
            unit="°C"
          />
        </div>
        <TrendCard
          title="Profit per acre trend"
          trend={analysis.trends["profitPerAcre"]}
          color="var(--good)"
          unit=" ₹"
        />

        {/* Insights + Evidence table */}
        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-harvest-gold" /> What needs a closer look
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {analysis.insights.length ? (
                analysis.insights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="border-l-4 border-harvest-gold pl-4">
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{insight.observation}</p>
                    <p className="mt-2 text-sm">
                      <strong>Next step:</strong> {insight.action}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No priority signals were found in this selection.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evidence rows</CardTitle>
              <p className="text-sm text-muted-foreground">
                The records behind this view, including calculated values.
              </p>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Field</th>
                      <th className="p-2">Crop</th>
                      <th className="p-2">Yield / acre</th>
                      <th className="p-2">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.evidence.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-t ${row.is_anomaly ? "bg-harvest-gold-soft" : ""}`}
                      >
                        <td className="p-2">{row.record_date}</td>
                        <td className="p-2">{row.field_name}</td>
                        <td className="p-2">{row.crop_name}</td>
                        <td className="p-2">
                          {number(row.yield_per_acre, " kg")}
                          {row.is_anomaly && (
                            <span className="ml-1 text-harvest-gold font-bold" title={row.anomaly_reason}>⚠</span>
                          )}
                        </td>
                        <td className="p-2">{money(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

// ─── Metric KPI Card ────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  icon,
  delta,
  highlight,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  delta?: number | null;
  highlight?: "good" | "warn" | "bad";
}) {
  const highlightClass =
    highlight === "good"
      ? "border-good/30 bg-good/5"
      : highlight === "warn"
        ? "border-harvest-gold/30 bg-harvest-gold-soft"
        : highlight === "bad"
          ? "border-destructive/30 bg-destructive/5"
          : "";

  return (
    <Card className={highlightClass}>
      <CardContent className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <p className="kpi-label">{label}</p>
          <p className="mt-2 text-2xl font-semibold truncate">{value}</p>
          {delta !== null && delta !== undefined && (
            <div
              className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${delta > 0 ? "text-good" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                }`}
            >
              {delta > 0 ? (
                <ArrowUpRight size={13} />
              ) : delta < 0 ? (
                <ArrowDownRight size={13} />
              ) : (
                <Minus size={13} />
              )}
              {delta === 0 ? "Stable" : `${Math.abs(delta)}% vs first`}
            </div>
          )}
        </div>
        <span className="rounded-lg bg-accent p-2 text-accent-foreground flex-shrink-0 ml-2">{icon}</span>
      </CardContent>
    </Card>
  );
}

// ─── Trend Chart Card ───────────────────────────────────────────────────────────

function TrendCard({
  title,
  trend,
  color,
  unit = "",
}: {
  title: string;
  trend: Trend | undefined;
  color: string;
  unit?: string;
}) {
  if (!trend) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {trend.direction === "stable"
            ? "Holding steady"
            : `${trend.direction} by ${Math.abs(trend.changePercent ?? 0)}%`}{" "}
          across your recorded months
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.points} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} />
              <YAxis width={42} tickLine={false} axisLine={false} />
              <Tooltip
                content={
                  <CustomTooltip
                    formatter={(v) => `${Math.round(v).toLocaleString("en-IN")}${unit}`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                name={title}
                stroke={color}
                strokeWidth={3}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filter Selector ────────────────────────────────────────────────────────────

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
