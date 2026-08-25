import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Droplets, XCircle } from "lucide-react";
import {
    Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "@/lib/location";
import { PageShell, LoadingState, ErrorState } from "./weather";

export const Route = createFileRoute("/irrigation")({
    component: IrrigationPage,
});

type DayIrrigation = {
    date: string;
    label: string;
    et0: number;
    rain: number;
    need: number; // et0 - rain, clamped >= 0
    action: "irrigate" | "skip";
};

const CROP_COEFFICIENTS: { crop: string; kc: number }[] = [
    { crop: "Rice", kc: 1.2 },
    { crop: "Wheat", kc: 1.0 },
    { crop: "Maize", kc: 1.05 },
    { crop: "Sugarcane", kc: 1.25 },
    { crop: "Cotton", kc: 1.1 },
    { crop: "Soybean", kc: 1.0 },
    { crop: "General", kc: 0.85 },
];

function IrrigationPage() {
    const { location } = useLocation();
    const [days, setDays] = useState<DayIrrigation[]>([]);
    const [selectedCrop, setSelectedCrop] = useState("General");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawData, setRawData] = useState<{ et0: number[]; rain: number[]; time: string[] } | null>(null);

    useEffect(() => {
        if (location.status !== "ready") return;
        const { lat, lng } = location;
        setLoading(true);
        setError(null);

        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lng));
        url.searchParams.set("daily", "et0_fao_evapotranspiration,precipitation_sum");
        url.searchParams.set("forecast_days", "7");
        url.searchParams.set("timezone", "auto");

        fetch(url.toString())
            .then((r) => r.json())
            .then((data: { daily?: { time: string[]; et0_fao_evapotranspiration: number[]; precipitation_sum: number[] } }) => {
                if (data.daily) {
                    setRawData({
                        et0: data.daily.et0_fao_evapotranspiration,
                        rain: data.daily.precipitation_sum,
                        time: data.daily.time,
                    });
                }
                setLoading(false);
            })
            .catch(() => {
                setError("Could not load evapotranspiration data. Please try again.");
                setLoading(false);
            });
    }, [location]);

    // Recalculate when crop or raw data changes
    useEffect(() => {
        if (!rawData) return;
        const kc = CROP_COEFFICIENTS.find((c) => c.crop === selectedCrop)?.kc ?? 0.85;
        const computed: DayIrrigation[] = rawData.time.map((date, i) => {
            const et0 = (rawData.et0[i] ?? 0) * kc;
            const rain = rawData.rain[i] ?? 0;
            const need = Math.max(0, et0 - rain);
            return {
                date,
                label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
                et0: Math.round(et0 * 10) / 10,
                rain: Math.round(rain * 10) / 10,
                need: Math.round(need * 10) / 10,
                action: need < 2 ? "skip" : "irrigate",
            };
        });
        setDays(computed);
    }, [rawData, selectedCrop]);

    if (location.status === "loading" || loading) {
        return <PageShell title="Irrigation Advisory"><LoadingState label="Fetching evapotranspiration data…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Irrigation Advisory"><ErrorState message={location.message} /></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Irrigation Advisory"><ErrorState message="Allow location to view irrigation advisory." /></PageShell>;
    }
    if (error) {
        return <PageShell title="Irrigation Advisory"><ErrorState message={error} /></PageShell>;
    }

    const todayAction = days[0]?.action;
    const totalNeed = days.reduce((s, d) => s + d.need, 0);
    const totalRain = days.reduce((s, d) => s + d.rain, 0);

    return (
        <PageShell
            title="Irrigation Advisory"
            subtitle={`7-day irrigation plan for ${location.city} · based on FAO-56 ET₀`}
        >
            {/* Crop selector */}
            <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <p className="text-sm font-medium">Crop:</p>
                    <div className="flex flex-wrap gap-2">
                        {CROP_COEFFICIENTS.map(({ crop }) => (
                            <button
                                key={crop}
                                onClick={() => setSelectedCrop(crop)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedCrop === crop
                                        ? "bg-primary text-primary-foreground"
                                        : "border bg-background hover:bg-accent"
                                    }`}
                            >
                                {crop}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Today's decision */}
            {days[0] && (
                <Card className={todayAction === "irrigate"
                    ? "border-rain/40 bg-rain/5 shadow-md"
                    : "border-good/40 bg-good/5 shadow-md"}>
                    <CardContent className="flex items-center gap-4 p-6">
                        {todayAction === "irrigate"
                            ? <Droplets size={40} className="text-rain flex-shrink-0" />
                            : <CheckCircle2 size={40} className="text-good flex-shrink-0" />}
                        <div>
                            <p className="text-lg font-bold">
                                {todayAction === "irrigate" ? "💧 Irrigate Today" : "✅ Skip Irrigation Today"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {todayAction === "irrigate"
                                    ? `Crop water need: ${days[0].need} mm · Expected rain: ${days[0].rain} mm · Apply ~${days[0].need} mm water`
                                    : `Expected rainfall (${days[0].rain} mm) covers crop water need (${days[0].et0} mm)`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Weekly summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground">7-day irrigation need</p>
                        <p className="text-3xl font-bold mt-1">{totalNeed.toFixed(1)} mm</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground">Expected rainfall</p>
                        <p className="text-3xl font-bold mt-1 text-rain">{totalRain.toFixed(1)} mm</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground">Days to irrigate</p>
                        <p className="text-3xl font-bold mt-1">{days.filter((d) => d.action === "irrigate").length} / 7</p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily bar chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Daily Irrigation Need vs Rainfall</CardTitle>
                    <p className="text-sm text-muted-foreground">Net irrigation need = ET₀ × Kc − expected rainfall</p>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={days} margin={{ left: 4, right: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                                <YAxis width={42} tickLine={false} axisLine={false} unit=" mm" />
                                <Tooltip
                                    formatter={(v: number, name: string) => [`${v} mm`, name]}
                                    contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }}
                                />
                                <ReferenceLine y={0} stroke="var(--border)" />
                                <Bar dataKey="need" name="Irrigation need" radius={[4, 4, 0, 0]}>
                                    {days.map((d, i) => (
                                        <Cell key={i} fill={d.action === "irrigate" ? "var(--rain)" : "var(--good)"} />
                                    ))}
                                </Bar>
                                <Bar dataKey="rain" name="Expected rain" fill="var(--harvest-gold)" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Daily schedule table */}
            <Card>
                <CardHeader>
                    <CardTitle>7-Day Irrigation Schedule</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Day</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">ET₀ × Kc</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rain</th>
                                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net need</th>
                                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {days.map((day, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium">{day.label}</td>
                                        <td className="px-4 py-3 text-right">{day.et0} mm</td>
                                        <td className="px-4 py-3 text-right text-rain">{day.rain} mm</td>
                                        <td className="px-4 py-3 text-right font-semibold">{day.need} mm</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center">
                                                {day.action === "irrigate"
                                                    ? <span className="flex items-center gap-1 text-rain text-xs font-medium"><Droplets size={13} /> Irrigate</span>
                                                    : <span className="flex items-center gap-1 text-good text-xs font-medium"><XCircle size={13} /> Skip</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 text-xs text-muted-foreground">
                    ET₀ is calculated using the FAO-56 Penman-Monteith method via Open-Meteo.
                    Kc (crop coefficient) adjusts for {selectedCrop} water requirements.
                    A threshold of 2 mm net need is used to decide whether irrigation is required.
                </CardContent>
            </Card>
        </PageShell>
    );
}
