import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "@/lib/location";
import { PageShell, LoadingState, ErrorState } from "./weather";

export const Route = createFileRoute("/soil")({
    component: SoilPage,
});

type SoilProperty = {
    name: string;
    label: string;
    value: number | null;
    unit: string;
    factor: number; // divide API value by this
    range: [number, number]; // ideal range for farming
    description: string;
};

const PROPERTIES: Omit<SoilProperty, "value">[] = [
    { name: "phh2o", label: "Soil pH", unit: "", factor: 10, range: [6, 7.5], description: "pH 6–7.5 is ideal for most crops. Below 6 = acidic (lime needed), above 7.5 = alkaline." },
    { name: "ocd", label: "Organic Carbon", unit: "g/kg", factor: 10, range: [10, 30], description: "Higher organic carbon = better fertility, water retention and microbial activity." },
    { name: "nitrogen", label: "Nitrogen", unit: "cg/kg", factor: 100, range: [1, 3], description: "Nitrogen is the primary growth nutrient. Low values suggest need for urea or compost." },
    { name: "clay", label: "Clay Content", unit: "%", factor: 10, range: [15, 40], description: "Clay affects water retention. Too high (>60%) causes waterlogging; too low (<10%) causes drought stress." },
    { name: "sand", label: "Sand Content", unit: "%", factor: 10, range: [20, 60], description: "Sandy soils drain fast and are low in nutrients — add organic matter regularly." },
    { name: "silt", label: "Silt Content", unit: "%", factor: 10, range: [20, 50], description: "Silt improves fertility and water-holding capacity." },
];

function healthLabel(value: number, range: [number, number]): "good" | "warn" | "bad" {
    if (value >= range[0] && value <= range[1]) return "good";
    const margin = (range[1] - range[0]) * 0.5;
    if (value >= range[0] - margin && value <= range[1] + margin) return "warn";
    return "bad";
}

function HealthBadge({ status }: { status: "good" | "warn" | "bad" }) {
    const map = {
        good: { label: "Optimal", cls: "text-good bg-good/10", icon: <CheckCircle2 size={12} /> },
        warn: { label: "Marginal", cls: "text-harvest-gold bg-harvest-gold-soft", icon: <Info size={12} /> },
        bad: { label: "Needs attention", cls: "text-destructive bg-destructive/10", icon: <AlertTriangle size={12} /> },
    };
    const { label, cls, icon } = map[status];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {icon} {label}
        </span>
    );
}

function SoilPage() {
    const { location } = useLocation();
    const [properties, setProperties] = useState<SoilProperty[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (location.status !== "ready") return;
        const { lat, lng } = location;
        setLoading(true);
        setError(null);

        const propertyParams = PROPERTIES.map((p) => `property=${p.name}`).join("&");
        const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&${propertyParams}&depth=0-5cm&value=mean`;

        fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error("SoilGrids request failed");
                return r.json();
            })
            .then((data: { properties?: { layers?: Array<{ name: string; depths?: Array<{ values?: { mean?: number | null } }> }> } }) => {
                const layers = data.properties?.layers ?? [];
                if (layers.length === 0) throw new Error("No soil data returned");
                const result: SoilProperty[] = PROPERTIES.map((prop) => {
                    const layer = layers.find((l) => l.name === prop.name);
                    const rawValue = layer?.depths?.[0]?.values?.mean ?? null;
                    const value = rawValue !== null ? rawValue / prop.factor : null;
                    return { ...prop, value };
                });
                setProperties(result);
                setLoading(false);
            })
            .catch(() => {
                setError("Could not load soil data from SoilGrids. Please try again.");
                setLoading(false);
            });
    }, [location]);

    if (location.status === "loading" || loading) {
        return <PageShell title="Soil Analysis"><LoadingState label="Fetching soil data for your coordinates…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Soil Analysis"><ErrorState message={location.message} /></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Soil Analysis"><ErrorState message="Allow location to view soil analysis." /></PageShell>;
    }
    if (error) {
        return <PageShell title="Soil Analysis"><ErrorState message={error} /></PageShell>;
    }

    return (
        <PageShell
            title="Soil Analysis"
            subtitle={`Soil properties at ${location.city} — 0–5 cm depth (SoilGrids ISRIC)`}
        >
            {/* Summary banner */}
            {properties.length > 0 && (() => {
                const good = properties.filter((p) => p.value !== null && healthLabel(p.value, p.range) === "good").length;
                const total = properties.filter((p) => p.value !== null).length;
                return (
                    <Card className="bg-primary text-primary-foreground shadow-lg shadow-primary/15">
                        <CardContent className="p-5">
                            <p className="text-sm opacity-75 uppercase tracking-wide">Overall soil health</p>
                            <p className="mt-1 text-3xl font-bold">{total > 0 ? Math.round((good / total) * 100) : 0}%</p>
                            <p className="text-sm opacity-80">{good} of {total} properties in the optimal range</p>
                        </CardContent>
                    </Card>
                );
            })()}

            {/* Property cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {properties.map((prop) => {
                    const display = prop.value !== null ? `${prop.value.toFixed(1)} ${prop.unit}`.trim() : "Unavailable";
                    const status = prop.value !== null ? healthLabel(prop.value, prop.range) : null;
                    const pct = prop.value !== null
                        ? Math.min(100, Math.max(0, ((prop.value - prop.range[0] * 0.5) / (prop.range[1] * 1.5 - prop.range[0] * 0.5)) * 100))
                        : 0;

                    return (
                        <Card key={prop.name}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base">{prop.label}</CardTitle>
                                    {status && <HealthBadge status={status} />}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-3xl font-bold">{display}</p>
                                <div>
                                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                        <span>Range: {prop.range[0]}–{prop.range[1]} {prop.unit}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${status === "good" ? "bg-good" : status === "warn" ? "bg-harvest-gold" : "bg-destructive"
                                                }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{prop.description}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                        Data sourced from <strong>SoilGrids v2.0</strong> by ISRIC – World Soil Information.
                        Values represent modelled estimates at 0–30 cm depth and may vary from on-ground measurements.
                        Ideal ranges are general guidelines — consult a local agronomist for crop-specific advice.
                    </p>
                </CardContent>
            </Card>
        </PageShell>
    );
}
