import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Bug, Leaf, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/location";
import { PageShell, LoadingState, ErrorState } from "./weather";
import { sendChatMessage } from "@/lib/gemini";

export const Route = createFileRoute("/pest")({
    component: PestPage,
});

type RiskLevel = "High" | "Medium" | "Low";

type PestAlert = {
    pest: string;
    crop: string;
    risk: RiskLevel;
    trigger: string;
    symptoms: string;
    prevention: string;
    treatment: string;
};

type PestReport = {
    summary: string;
    alerts: PestAlert[];
    general_advice: string;
};

type WeatherConditions = {
    temp: number;
    humidity: number;
    rain: number;
};

async function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherConditions> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto`;
    const r = await fetch(url);
    const d = (await r.json()) as { current?: { temperature_2m: number; relative_humidity_2m: number; precipitation: number } };
    return {
        temp: d.current?.temperature_2m ?? 25,
        humidity: d.current?.relative_humidity_2m ?? 60,
        rain: d.current?.precipitation ?? 0,
    };
}

function currentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 10) return "Kharif";
    if (month >= 11 || month <= 3) return "Rabi";
    return "Zaid";
}

// ─── Rule-based fallback (used when Gemini is unavailable) ────────────────────
function buildFallbackReport(wx: WeatherConditions, season: string): PestReport {
    const alerts: PestAlert[] = [];

    // Fungal disease risk — high humidity + warm
    if (wx.humidity > 70) {
        alerts.push({
            pest: "Blast / Blight (Fungal)",
            crop: season === "Kharif" ? "Rice" : "Wheat",
            risk: wx.humidity > 85 ? "High" : "Medium",
            trigger: `Humidity at ${wx.humidity}% creates ideal conditions for fungal spore germination`,
            symptoms: "Water-soaked lesions on leaves; greyish spots with brown borders; neck rot in rice",
            prevention: "Avoid excess nitrogen fertiliser; maintain proper plant spacing for air circulation",
            treatment: "Spray Tricyclazole 75WP at 0.6 g/L or Propiconazole 25EC at 1 ml/L water at first sign",
        });
    }

    // Aphid / whitefly risk — hot and dry
    if (wx.temp > 30 && wx.humidity < 65) {
        alerts.push({
            pest: "Aphids / Whitefly",
            crop: season === "Kharif" ? "Cotton" : "Mustard",
            risk: wx.temp > 35 ? "High" : "Medium",
            trigger: `High temperature (${wx.temp}°C) and low humidity favour sap-sucking insects`,
            symptoms: "Curling leaves, yellow patches, honeydew deposits and sooty mould",
            prevention: "Install yellow sticky traps; encourage beneficial insects; avoid excess nitrogen",
            treatment: "Spray imidacloprid 17.8SL at 0.5 ml/L or neem oil 5 ml/L water",
        });
    }

    // Brown Planthopper — warm and wet
    if (season === "Kharif" && wx.humidity > 75 && wx.temp >= 24 && wx.temp <= 32) {
        alerts.push({
            pest: "Brown Planthopper (BPH)",
            crop: "Rice",
            risk: "High",
            trigger: `Temperature ${wx.temp}°C and humidity ${wx.humidity}% are ideal for BPH multiplication`,
            symptoms: "Yellowing & drying of plants in circular patches (hopperburn); hopping insects at base",
            prevention: "Use BPH-resistant varieties; avoid excess nitrogen; drain water for 3–4 days",
            treatment: "Spray Buprofezin 25SC at 1 ml/L or Pymetrozine 50WG at 0.3 g/L water",
        });
    }

    // General caterpillar / bollworm
    alerts.push({
        pest: "Caterpillar / Bollworm",
        crop: season === "Kharif" ? "Soybean / Cotton" : "Chickpea / Vegetables",
        risk: "Medium",
        trigger: "Warm nights (>18°C) increase moth activity and egg-laying",
        symptoms: "Circular holes in leaves/bolls; frass (excrement) on leaves; damaged growing tips",
        prevention: "Install pheromone traps (1 per acre); hand-pick egg masses; intercrop with marigold",
        treatment: "Spray Chlorantraniliprole 18.5SC at 0.4 ml/L or Spinosad 45SC at 0.3 ml/L water",
    });

    // Rust — rabi wheat
    if (season === "Rabi" && wx.humidity > 60) {
        alerts.push({
            pest: "Yellow / Brown Rust",
            crop: "Wheat",
            risk: wx.humidity > 80 ? "High" : "Medium",
            trigger: `Cool temperatures with humidity ${wx.humidity}% favour rust spread`,
            symptoms: "Yellow or orange powdery pustules on leaves and stem; premature ripening",
            prevention: "Use rust-resistant varieties; apply recommended seed treatment before sowing",
            treatment: "Spray Propiconazole 25EC at 1 ml/L water at flag-leaf stage",
        });
    }

    return {
        summary: `${alerts.filter(a => a.risk === "High").length} high-risk ${alerts.filter(a => a.risk === "High").length === 1 ? "threat" : "threats"} detected based on current weather conditions (${season} season).`,
        alerts,
        general_advice: "Inspect crops at least twice a week during peak growing season. Use Integrated Pest Management (IPM): prefer cultural and biological controls first, use chemical sprays only when pest counts exceed economic threshold levels. Keep spray records and rotate chemical groups to prevent resistance.",
    };
}


function RiskBadge({ level }: { level: RiskLevel }) {
    const cls = level === "High"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : level === "Medium"
            ? "bg-harvest-gold-soft text-harvest-gold border-harvest-gold/30"
            : "bg-good/10 text-good border-good/30";
    return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{level} Risk</span>;
}

function PestPage() {
    const { location } = useLocation();
    const [report, setReport] = useState<PestReport | null>(null);
    const [weather, setWeather] = useState<WeatherConditions | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFallback, setIsFallback] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function fetchAlerts(lat: number, lng: number, city: string) {
        setLoading(true);
        setError(null);
        let wx: WeatherConditions = { temp: 28, humidity: 65, rain: 0 };
        const season = currentSeason();
        try {
            wx = await fetchCurrentWeather(lat, lng);
            setWeather(wx);

            const prompt = `You are an Indian agricultural pest and disease expert.

Location: ${city}
Season: ${season}
Current temperature: ${wx.temp}°C
Current humidity: ${wx.humidity}%
Recent rainfall: ${wx.rain} mm

Based on these conditions, identify the top pest and disease threats for farmers in this region and season.

Return ONLY valid JSON (no markdown):
{
  "summary": "Brief 1-sentence overall risk summary for this region and season",
  "alerts": [
    {
      "pest": "Brown Planthopper",
      "crop": "Rice",
      "risk": "High",
      "trigger": "High humidity (>80%) and temperatures 25-30°C favor rapid multiplication",
      "symptoms": "Yellowing and drying of plants in circular patches (hopperburn)",
      "prevention": "Use resistant varieties, avoid excess nitrogen, maintain field hygiene",
      "treatment": "Spray imidacloprid 17.8SL at 0.5ml/L water. Drain water for 3 days."
    }
  ],
  "general_advice": "One paragraph of general integrated pest management advice for this location and season"
}

Provide 4-6 realistic alerts for crops commonly grown in ${city} during ${season} season. Consider the weather conditions — high humidity and warm temperatures increase fungal disease risk.`;

            const reply = await sendChatMessage([], prompt);
            const jsonMatch = reply.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Invalid response");
            setReport(JSON.parse(jsonMatch[0]) as PestReport);
            setIsFallback(false);
        } catch {
            // Gemini unavailable — use rule-based fallback from live weather
            setReport(buildFallbackReport(wx, season));
            setIsFallback(true);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (location.status !== "ready") return;
        void fetchAlerts(location.lat, location.lng, location.city);
    }, [location]);

    if (location.status === "loading") {
        return <PageShell title="Pest & Disease Alerts"><LoadingState label="Detecting location…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Pest & Disease Alerts"><ErrorState message={location.message} /></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Pest & Disease Alerts"><ErrorState message="Allow location to view alerts." /></PageShell>;
    }
    if (loading) {
        return <PageShell title="Pest & Disease Alerts"><LoadingState label="Analysing pest risk for your region and current weather…" /></PageShell>;
    }
    // Note: no hard error — fallback report is shown when Gemini fails

    return (
        <PageShell
            title="Pest & Disease Alerts"
            subtitle={`${location.city} · ${currentSeason()} season · AI-powered risk assessment`}
        >
            {/* Weather trigger panel */}
            {weather && (
                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { label: "Temperature", value: `${weather.temp}°C`, risk: weather.temp > 30 && weather.temp < 38 ? "Medium" : "Low" },
                        { label: "Humidity", value: `${weather.humidity}%`, risk: weather.humidity > 80 ? "High" : weather.humidity > 65 ? "Medium" : "Low" },
                        { label: "Rainfall", value: `${weather.rain} mm`, risk: "Low" },
                    ].map((item) => (
                        <Card key={item.label} className="text-center">
                            <CardContent className="py-4">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-2xl font-bold">{item.value}</p>
                                <RiskBadge level={item.risk as RiskLevel} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {report && (
                <>
                    {/* Fallback notice */}
                    {isFallback && (
                        <Card className="border-harvest-gold/40 bg-harvest-gold-soft">
                            <CardContent className="flex items-center gap-2 p-3 text-xs text-harvest-gold">
                                <AlertTriangle size={14} />
                                <span>Gemini AI unavailable — showing rule-based alerts from live weather data. <button className="underline font-medium" onClick={() => location.status === "ready" && void fetchAlerts(location.lat, location.lng, location.city)}>Retry with AI</button></span>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary banner */}
                    <Card className={`border-l-4 ${report.alerts.some((a) => a.risk === "High") ? "border-destructive" : "border-harvest-gold"}`}>
                        <CardContent className="flex items-start gap-3 p-4">
                            <AlertTriangle className={report.alerts.some((a) => a.risk === "High") ? "text-destructive mt-0.5" : "text-harvest-gold mt-0.5"} size={20} />
                            <p className="text-sm font-medium">{report.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Refresh */}
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" className="gap-2"
                            onClick={() => location.status === "ready" && void fetchAlerts(location.lat, location.lng, location.city)}>
                            <RefreshCw size={14} /> Refresh analysis
                        </Button>
                    </div>

                    {/* Alert cards */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {report.alerts.map((alert, i) => (
                            <Card key={i} className={alert.risk === "High" ? "border-destructive/30" : alert.risk === "Medium" ? "border-harvest-gold/30" : ""}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Bug size={18} className="text-muted-foreground flex-shrink-0" />
                                            <div>
                                                <CardTitle className="text-base">{alert.pest}</CardTitle>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Leaf size={11} /> {alert.crop}
                                                </p>
                                            </div>
                                        </div>
                                        <RiskBadge level={alert.risk} />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Weather trigger</p>
                                        <p className="text-muted-foreground">{alert.trigger}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Symptoms</p>
                                        <p className="text-muted-foreground">{alert.symptoms}</p>
                                    </div>
                                    <div className="rounded-lg bg-good/5 border border-good/20 p-3">
                                        <p className="text-xs font-semibold text-good mb-1 flex items-center gap-1"><ShieldCheck size={12} /> Prevention</p>
                                        <p className="text-muted-foreground text-xs">{alert.prevention}</p>
                                    </div>
                                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                                        <p className="text-xs font-semibold text-destructive mb-1">Treatment</p>
                                        <p className="text-muted-foreground text-xs">{alert.treatment}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* General advice */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShieldCheck className="text-primary" size={18} /> Integrated Pest Management Advice
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">{report.general_advice}</p>
                        </CardContent>
                    </Card>
                </>
            )}
        </PageShell>
    );
}
