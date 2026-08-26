import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/location";
import { PageShell, LoadingState } from "./weather";
import { sendChatMessage } from "@/lib/gemini";

export const Route = createFileRoute("/prices")({
    component: PricesPage,
});

type CropPrice = {
    crop: string;
    price: string;
    unit: string;
    trend: "up" | "down" | "stable";
    notes: string;
};

type PriceData = {
    location: string;
    season: string;
    prices: CropPrice[];
    disclaimer: string;
    source: "ceda" | "gemini" | "fallback";
    lastUpdated?: string;
};

// Crop names as used in the CEDA/Agmarknet API
const CEDA_CROPS = [
    { display: "Rice", agmarknet: "Rice" },
    { display: "Wheat", agmarknet: "Wheat" },
    { display: "Maize", agmarknet: "Maize" },
    { display: "Soybean", agmarknet: "Soyabean" },
    { display: "Cotton", agmarknet: "Cotton" },
    { display: "Sugarcane", agmarknet: "Sugarcane" },
    { display: "Groundnut", agmarknet: "Groundnut" },
    { display: "Turmeric", agmarknet: "Turmeric" },
    { display: "Onion", agmarknet: "Onion" },
    { display: "Tomato", agmarknet: "Tomato" },
];

// State name mapping from city (best-effort)
const STATE_MAP: Record<string, string> = {
    chennai: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu",
    trichy: "Tamil Nadu", salem: "Tamil Nadu", tirunelveli: "Tamil Nadu",
    mumbai: "Maharashtra", pune: "Maharashtra", nagpur: "Maharashtra",
    delhi: "Delhi", "new delhi": "Delhi",
    bengaluru: "Karnataka", bangalore: "Karnataka", mysuru: "Karnataka",
    hyderabad: "Telangana", warangal: "Telangana",
    kolkata: "West Bengal", ahmedabad: "Gujarat", surat: "Gujarat",
    jaipur: "Rajasthan", jodhpur: "Rajasthan",
    lucknow: "Uttar Pradesh", kanpur: "Uttar Pradesh", agra: "Uttar Pradesh",
    patna: "Bihar", bhopal: "Madhya Pradesh", indore: "Madhya Pradesh",
    chandigarh: "Punjab", amritsar: "Punjab",
};

function guessState(city: string): string {
    const lower = city.toLowerCase();
    for (const [key, state] of Object.entries(STATE_MAP)) {
        if (lower.includes(key)) return state;
    }
    return "Tamil Nadu"; // sensible default
}

function currentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 10) return "Kharif 2025";
    if (month >= 11 || month <= 3) return "Rabi 2024-25";
    return "Zaid 2025";
}

// ─── CEDA Agmarknet API response shape ────────────────────────────────────────
type CedaRecord = {
    commodity?: string;
    min_price?: number;
    max_price?: number;
    modal_price?: number;
    arrival_date?: string;
    market?: string;
    state?: string;
};

type CedaResponse = {
    results?: CedaRecord[];
    count?: number;
};

const CEDA_KEY = (import.meta.env["VITE_CEDA_API_KEY"] as string | undefined) ?? "";

// Fetch one crop from CEDA. Returns modal price in ₹/quintal or null.
async function fetchCropFromCeda(agmarknetName: string, state: string): Promise<number | null> {
    if (!CEDA_KEY) return null;

    // Today and 7 days ago for a window of recent data
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const url = `https://api.ceda.ashoka.edu.in/v1/agmarknet/prices`;
    const body = {
        commodity: agmarknetName,
        state,
        date_from: fmt(weekAgo),
        date_to: fmt(today),
        limit: 10,
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CEDA_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json() as CedaResponse;
    const records = data.results ?? [];
    if (records.length === 0) return null;

    // Average of modal prices across available markets
    const modalPrices = records
        .map((r) => r.modal_price ?? null)
        .filter((p): p is number => p !== null);

    if (modalPrices.length === 0) return null;
    return modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length;
}

// Convert ₹/quintal → ₹/kg and determine trend vs fallback baseline
function toKg(quintalPrice: number): string {
    return (quintalPrice / 100).toFixed(2);
}

function inferTrend(priceKg: number, fallbackKg: string): "up" | "down" | "stable" {
    const fb = parseFloat(fallbackKg);
    const diff = (priceKg - fb) / fb;
    if (diff > 0.03) return "up";
    if (diff < -0.03) return "down";
    return "stable";
}

// ─── Static fallback (shown when both CEDA and Gemini are unavailable) ─────────
const FALLBACK_PRICES: CropPrice[] = [
    { crop: "Rice", price: "22.00", unit: "₹/kg", trend: "up", notes: "Strong local demand for Ponni and IR20 varieties" },
    { crop: "Wheat", price: "22.75", unit: "₹/kg", trend: "stable", notes: "MSP backed pricing in regional mandis" },
    { crop: "Cotton", price: "69.50", unit: "₹/kg", trend: "up", notes: "Moderate arrivals in Virudhunagar markets" },
    { crop: "Sugarcane", price: "3.25", unit: "₹/kg", trend: "stable", notes: "FRP and local cooperative mill rates" },
    { crop: "Soybean", price: "45.00", unit: "₹/kg", trend: "stable", notes: "Steady demand from crushing units" },
    { crop: "Maize", price: "19.50", unit: "₹/kg", trend: "up", notes: "High demand from poultry feed industries in Tamil Nadu" },
    { crop: "Turmeric", price: "145.00", unit: "₹/kg", trend: "up", notes: "Strong regional interest near Erode trade corridors" },
    { crop: "Onion", price: "13.50", unit: "₹/kg", trend: "down", notes: "Arrivals from neighbouring districts increasing" },
    { crop: "Tomato", price: "9.00", unit: "₹/kg", trend: "down", notes: "Seasonal harvest peak affecting local wholesale rates" },
    { crop: "Groundnut", price: "61.00", unit: "₹/kg", trend: "up", notes: "Good local oil mill demand in southern districts" },
];

// ─── Tier 1: CEDA real-time data ──────────────────────────────────────────────
async function fetchFromCeda(city: string): Promise<PriceData | null> {
    if (!CEDA_KEY) return null;
    const state = guessState(city);
    const results = await Promise.allSettled(
        CEDA_CROPS.map((c) => fetchCropFromCeda(c.agmarknet, state))
    );

    const prices: CropPrice[] = [];
    results.forEach((r, i) => {
        const crop = CEDA_CROPS[i];
        if (!crop) return;
        const fallback = FALLBACK_PRICES.find((f) => f.crop === crop.display);
        if (r.status === "fulfilled" && r.value !== null) {
            const priceKg = r.value / 100;
            prices.push({
                crop: crop.display,
                price: priceKg.toFixed(2),
                unit: "₹/kg",
                trend: inferTrend(priceKg, fallback?.price ?? "0"),
                notes: `Live Agmarknet data · ${state} markets`,
            });
        } else if (fallback) {
            // Use fallback for crops CEDA didn't return
            prices.push({ ...fallback, notes: `No recent Agmarknet data · ${fallback.notes}` });
        }
    });

    if (prices.filter((p) => p.notes.includes("Live")).length === 0) return null;

    return {
        location: city,
        season: currentSeason(),
        prices,
        disclaimer: `Live prices from Agmarknet via CEDA Ashoka University API. Data sourced from ${state} mandis. Verify with your local mandi before selling.`,
        source: "ceda",
        lastUpdated: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    };
}

// ─── Tier 2: Gemini AI estimates ──────────────────────────────────────────────
async function fetchFromGemini(city: string): Promise<PriceData | null> {
    const season = currentSeason();
    const prompt = `You are an agricultural market price expert for India.

For a farmer located near "${city}" in the ${season} season, provide current estimated mandi (wholesale market) prices for common crops.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "location": "${city}",
  "season": "${season}",
  "prices": [
    { "crop": "Rice",       "price": "22.00",  "unit": "₹/kg", "trend": "up",     "notes": "Good demand from exporters" },
    { "crop": "Wheat",      "price": "22.75",  "unit": "₹/kg", "trend": "stable", "notes": "MSP backed pricing" },
    { "crop": "Cotton",     "price": "69.50",  "unit": "₹/kg", "trend": "down",   "notes": "Global supply pressure" },
    { "crop": "Sugarcane",  "price": "3.25",   "unit": "₹/kg", "trend": "stable", "notes": "FRP / cooperative mill rate" },
    { "crop": "Soybean",    "price": "45.00",  "unit": "₹/kg", "trend": "up",     "notes": "Crushing demand strong" },
    { "crop": "Maize",      "price": "19.50",  "unit": "₹/kg", "trend": "up",     "notes": "Poultry sector demand" },
    { "crop": "Turmeric",   "price": "145.00", "unit": "₹/kg", "trend": "up",     "notes": "Export demand rising" },
    { "crop": "Onion",      "price": "13.50",  "unit": "₹/kg", "trend": "stable", "notes": "Season transition stock" },
    { "crop": "Tomato",     "price": "9.00",   "unit": "₹/kg", "trend": "down",   "notes": "Arrival peak dampens prices" },
    { "crop": "Groundnut",  "price": "61.00",  "unit": "₹/kg", "trend": "stable", "notes": "Oil demand holding prices" }
  ],
  "disclaimer": "These are AI-estimated prices based on recent trends. Always verify with your local mandi before selling."
}

Adjust prices realistically in ₹/kg for the ${city} region and ${season} season. Use actual MSP converted to ₹/kg where applicable.`;

    try {
        const reply = await sendChatMessage([], prompt);
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]) as Omit<PriceData, "source">;
        return { ...parsed, source: "gemini" };
    } catch {
        return null;
    }
}

// ─── Source badge component ────────────────────────────────────────────────────
function SourceBadge({ source }: { source: PriceData["source"] }) {
    if (source === "ceda") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-good/10 text-good border border-good/20 px-3 py-1 text-xs font-semibold">
                <Database size={11} /> Live · Agmarknet / CEDA
            </span>
        );
    }
    if (source === "gemini") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rain/10 text-rain border border-rain/20 px-3 py-1 text-xs font-semibold">
                <Sparkles size={11} /> AI Estimates · Gemini
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-harvest-gold-soft text-harvest-gold border border-harvest-gold/20 px-3 py-1 text-xs font-semibold">
            <AlertTriangle size={11} /> Curated Baseline
        </span>
    );
}

function PricesPage() {
    const { location } = useLocation();
    const [data, setData] = useState<PriceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingTier, setLoadingTier] = useState("");

    async function fetchPrices(city: string) {
        setLoading(true);
        setData(null);

        // Tier 1: CEDA real-time
        setLoadingTier("Fetching live Agmarknet prices via CEDA…");
        const cedaData = await fetchFromCeda(city);
        if (cedaData) {
            setData(cedaData);
            setLoading(false);
            setLoadingTier("");
            return;
        }

        // Tier 2: Gemini AI estimates
        setLoadingTier("Getting AI price estimates from Gemini…");
        const geminiData = await fetchFromGemini(city);
        if (geminiData) {
            setData(geminiData);
            setLoading(false);
            setLoadingTier("");
            return;
        }

        // Tier 3: Static fallback
        setData({
            location: city,
            season: currentSeason(),
            prices: FALLBACK_PRICES,
            disclaimer: "Both CEDA and Gemini are unavailable. Showing curated baseline MSP/mandi prices. Always verify with your local mandi before selling.",
            source: "fallback",
        });
        setLoading(false);
        setLoadingTier("");
    }

    useEffect(() => {
        if (location.status !== "ready") return;
        void fetchPrices(location.city);
    }, [location]);

    if (location.status === "loading") {
        return <PageShell title="Crop Market Prices"><LoadingState label="Detecting your location…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Crop Market Prices"><div className="p-6 text-center text-muted-foreground">{location.message}</div></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Crop Market Prices"><div className="p-6 text-center text-muted-foreground">Allow location to view prices.</div></PageShell>;
    }
    if (loading) {
        return <PageShell title="Crop Market Prices"><LoadingState label={loadingTier || "Fetching prices…"} /></PageShell>;
    }

    return (
        <PageShell
            title="Crop Market Prices"
            subtitle={data ? `${data.location} · ${data.season}` : ""}
        >
            {data && (
                <>
                    {/* Source badge + refresh */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <SourceBadge source={data.source} />
                            {data.lastUpdated && (
                                <span className="text-xs text-muted-foreground">Updated: {data.lastUpdated}</span>
                            )}
                        </div>
                        <Button variant="outline" size="sm" className="gap-2"
                            onClick={() => void fetchPrices(location.status === "ready" ? location.city : "")}>
                            <RefreshCw size={14} /> Refresh
                        </Button>
                    </div>

                    {/* CEDA key missing notice */}
                    {!CEDA_KEY && (
                        <Card className="border-rain/30 bg-rain/5">
                            <CardContent className="flex items-start gap-3 p-4">
                                <Database size={16} className="text-rain mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p className="font-semibold text-foreground">Enable Live Mandi Prices</p>
                                    <p>Add <code className="bg-muted px-1 rounded">VITE_CEDA_API_KEY=your_key</code> to your <code className="bg-muted px-1 rounded">.env</code> file to get real-time Agmarknet data from the CEDA Ashoka University API.</p>
                                    <p>Register free at <a href="https://api.ceda.ashoka.edu.in" target="_blank" rel="noreferrer" className="underline text-rain">api.ceda.ashoka.edu.in</a></p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Price table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {data.source === "ceda" ? "Live Mandi Prices" : "Estimated Mandi Prices"}
                                {data.source === "ceda" && <CheckCircle2 size={16} className="text-good" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Crop</th>
                                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price (₹/kg)</th>
                                            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Trend</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Market Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.prices.map((row, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium">{row.crop}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-bold text-foreground">{row.price}</span>
                                                    <span className="ml-1 text-xs text-muted-foreground">{row.unit}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center">
                                                        {row.trend === "up" && <span className="flex items-center gap-1 text-good text-xs font-medium"><TrendingUp size={14} /> Up</span>}
                                                        {row.trend === "down" && <span className="flex items-center gap-1 text-destructive text-xs font-medium"><TrendingDown size={14} /> Down</span>}
                                                        {row.trend === "stable" && <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium"><Minus size={14} /> Stable</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.notes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Disclaimer */}
                    <Card className="border-harvest-gold/30 bg-harvest-gold-soft">
                        <CardContent className="p-4 text-xs text-muted-foreground">
                            ⚠️ {data.disclaimer}
                        </CardContent>
                    </Card>
                </>
            )}
        </PageShell>
    );
}
