import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/location";
import { PageShell, LoadingState, ErrorState } from "./weather";
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
};

function currentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 10) return "Kharif 2025";
    if (month >= 11 || month <= 3) return "Rabi 2024-25";
    return "Zaid 2025";
}

// ─── Static fallback (shown when Gemini is unavailable) ────────────────────────
const FALLBACK_PRICES: CropPrice[] = [
    { crop: "Rice", price: "2183", unit: "₹/quintal", trend: "up", notes: "MSP ₹2183 (2024-25), export demand firm" },
    { crop: "Wheat", price: "2275", unit: "₹/quintal", trend: "stable", notes: "Govt MSP ₹2275, central procurement active" },
    { crop: "Maize", price: "1850", unit: "₹/quintal", trend: "up", notes: "Poultry & starch industry demand strong" },
    { crop: "Soybean", price: "4600", unit: "₹/quintal", trend: "stable", notes: "MSP ₹4892, arrivals slightly below avg" },
    { crop: "Cotton", price: "6800", unit: "₹/quintal", trend: "down", notes: "Global oversupply weighing on prices" },
    { crop: "Sugarcane", price: "315", unit: "₹/quintal", trend: "stable", notes: "State advised price, mill payments delayed" },
    { crop: "Groundnut", price: "5850", unit: "₹/quintal", trend: "up", notes: "Oil extraction demand; MSP ₹6377" },
    { crop: "Turmeric", price: "13500", unit: "₹/quintal", trend: "up", notes: "Export demand; Nizamabad prices elevated" },
    { crop: "Onion", price: "1100", unit: "₹/quintal", trend: "stable", notes: "Lasalgaon market, arrivals normalising" },
    { crop: "Tomato", price: "700", unit: "₹/quintal", trend: "down", notes: "Peak arrival season caps prices" },
];


function PricesPage() {
    const { location } = useLocation();
    const [data, setData] = useState<PriceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFallback, setIsFallback] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function fetchPrices(city: string) {
        setLoading(true);
        setError(null);
        const season = currentSeason();
        const prompt = `You are an agricultural market price expert for India.

For a farmer located near "${city}" in the ${season} season, provide current estimated mandi (wholesale market) prices for common crops.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "location": "${city}",
  "season": "${season}",
  "prices": [
    { "crop": "Rice", "price": "2100", "unit": "₹/quintal", "trend": "up", "notes": "Good demand from exporters" },
    { "crop": "Wheat", "price": "2275", "unit": "₹/quintal", "trend": "stable", "notes": "MSP declared at ₹2275" },
    { "crop": "Cotton", "price": "6800", "unit": "₹/quintal", "trend": "down", "notes": "Global supply pressure" },
    { "crop": "Sugarcane", "price": "315", "unit": "₹/quintal", "trend": "stable", "notes": "State-advised price" },
    { "crop": "Soybean", "price": "4600", "unit": "₹/quintal", "trend": "up", "notes": "Good crushing demand" },
    { "crop": "Maize", "price": "1850", "unit": "₹/quintal", "trend": "up", "notes": "Poultry sector demand strong" },
    { "crop": "Turmeric", "price": "14000", "unit": "₹/quintal", "trend": "up", "notes": "Export demand rising" },
    { "crop": "Onion", "price": "1200", "unit": "₹/quintal", "trend": "stable", "notes": "Season transition stock" },
    { "crop": "Tomato", "price": "800", "unit": "₹/quintal", "trend": "down", "notes": "Arrival peak dampens prices" },
    { "crop": "Groundnut", "price": "5800", "unit": "₹/quintal", "trend": "stable", "notes": "Oil demand holding prices" }
  ],
  "disclaimer": "These are AI-estimated prices based on recent trends. Always verify with your local mandi before selling."
}

Adjust prices realistically for the ${city} region and ${season} season. Use actual MSP where applicable.`;

        try {
            const reply = await sendChatMessage([], prompt);
            const jsonMatch = reply.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Invalid response format");
            const parsed = JSON.parse(jsonMatch[0]) as PriceData;
            setData(parsed);
            setIsFallback(false);
        } catch {
            // Gemini unavailable — show curated static prices
            setData({
                location: city,
                season: currentSeason(),
                prices: FALLBACK_PRICES,
                disclaimer: "Gemini AI is unavailable. Showing curated baseline MSP/mandi prices for India. Always verify with your local mandi before selling.",
            });
            setIsFallback(true);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (location.status !== "ready") return;
        void fetchPrices(location.city);
    }, [location]);

    if (location.status === "loading") {
        return <PageShell title="Crop Market Prices"><LoadingState label="Detecting your location…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Crop Market Prices"><ErrorState message={location.message} /></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Crop Market Prices"><ErrorState message="Allow location to view prices." /></PageShell>;
    }
    if (loading) {
        return <PageShell title="Crop Market Prices"><LoadingState label="Fetching price estimates for your region…" /></PageShell>;
    }
    // No hard error — fallback is used instead

    return (
        <PageShell
            title="Crop Market Prices"
            subtitle={data ? `${data.location} · ${data.season} · AI-estimated mandi prices` : ""}
        >
            {data && (
                <>
                    {/* Fallback notice */}
                    {isFallback && (
                        <Card className="border-harvest-gold/40 bg-harvest-gold-soft">
                            <CardContent className="flex items-center gap-2 p-3 text-xs text-harvest-gold">
                                <AlertTriangle size={14} />
                                <span>Gemini AI unavailable — showing curated baseline prices. <button className="underline font-medium" onClick={() => void fetchPrices(location.status === "ready" ? location.city : "")}>Retry with AI</button></span>
                            </CardContent>
                        </Card>
                    )}

                    {/* Refresh */}
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchPrices(location.status === "ready" ? location.city : "")}>
                            <RefreshCw size={14} /> Refresh estimates
                        </Button>
                    </div>

                    {/* Price table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Estimated Mandi Prices</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Crop</th>
                                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
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
