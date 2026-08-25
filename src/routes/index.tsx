import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  FileUp,
  Leaf,
  RefreshCw,
  Sprout,
  UploadCloud,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  return (
    <DatasetProvider>
      <FarmWorkspace />
    </DatasetProvider>
  );
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
  const money = (value: number | null) =>
    value === null ? "Unavailable" : `₹${Math.round(value).toLocaleString("en-IN")}`;
  const number = (value: number | null, suffix = "") =>
    value === null ? "Unavailable" : `${Math.round(value).toLocaleString("en-IN")}${suffix}`;
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Total yield"
            value={number(analysis.totals.totalYield, " kg")}
            icon={<Leaf />}
          />
          <Metric
            label="Average yield / acre"
            value={number(analysis.totals.avgYieldPerAcre, " kg")}
            icon={<ArrowUpRight />}
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
          />
        </div>
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
        <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Card>
            <CardHeader>
              <CardTitle>Yield per acre</CardTitle>
              <p className="text-sm text-muted-foreground">
                {trend?.direction === "stable"
                  ? "Holding steady"
                  : `${trend?.direction} by ${Math.abs(trend?.changePercent ?? 0)}%`}{" "}
                across your recorded months
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend?.points ?? []}>
                    <defs>
                      <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--harvest-green)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--harvest-green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis width={45} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--harvest-green)"
                      fill="url(#yieldFill)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
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
                      className="h-full rounded-full bg-harvest-gold"
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
        <Card>
          <CardHeader>
            <CardTitle>Crop comparison</CardTitle>
            <p className="text-sm text-muted-foreground">
              Average yield per acre across the crops in this selection
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analysis.byCrop.map((crop) => ({
                    name: crop.name,
                    yieldPerAcre: crop.yieldPerAcre ?? 0,
                  }))}
                  layout="vertical"
                  margin={{ left: 12, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="yieldPerAcre" name="Yield per acre" radius={[0, 5, 5, 0]}>
                    {analysis.byCrop.map((crop, index) => (
                      <Cell
                        key={crop.name}
                        fill={index % 2 === 0 ? "var(--harvest-green)" : "var(--harvest-gold)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <TrendCard title="Rainfall trend" trend={analysis.trends["rainfall"]} color="var(--rain)" />
          <TrendCard
            title="Temperature trend"
            trend={analysis.trends["temperature"]}
            color="var(--harvest-gold)"
          />
        </div>
        <TrendCard
          title="Profit per acre trend"
          trend={analysis.trends["profitPerAcre"]}
          color="var(--good)"
        />
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
                          {row.is_anomaly && " *"}
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

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="kpi-label">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <span className="rounded-lg bg-accent p-2 text-accent-foreground">{icon}</span>
      </CardContent>
    </Card>
  );
}

function TrendCard({
  title,
  trend,
  color,
}: {
  title: string;
  trend: Trend | undefined;
  color: string;
}) {
  if (!trend) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {trend.direction === "stable"
            ? "Holding steady"
            : `${trend.direction} by ${Math.abs(trend.changePercent ?? 0)}%`} across your recorded
          months
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.points} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} />
              <YAxis width={42} tickLine={false} axisLine={false} />
              <Tooltip />
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
