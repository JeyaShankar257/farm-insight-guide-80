import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
    Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow,
    Droplets, Eye, Sun, Thermometer, Wind,
} from "lucide-react";
import {
    Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "@/lib/location";

export const Route = createFileRoute("/weather")({
    component: WeatherPage,
});

// ─── WMO Weather Code helpers ──────────────────────────────────────────────────
function wmoIcon(code: number, size = 28) {
    if (code === 0) return <Sun size={size} className="text-harvest-gold" />;
    if (code <= 3) return <Cloud size={size} className="text-muted-foreground" />;
    if (code <= 48) return <Cloud size={size} className="text-muted-foreground" />;
    if (code <= 55) return <CloudDrizzle size={size} className="text-rain" />;
    if (code <= 67) return <CloudRain size={size} className="text-rain" />;
    if (code <= 77) return <CloudSnow size={size} className="text-rain" />;
    if (code <= 82) return <CloudRain size={size} className="text-rain" />;
    return <CloudLightning size={size} className="text-harvest-gold" />;
}

function wmoLabel(code: number): string {
    if (code === 0) return "Clear sky";
    if (code === 1) return "Mainly clear";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code <= 48) return "Foggy";
    if (code <= 55) return "Drizzle";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    return "Thunderstorm";
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type CurrentWeather = {
    temperature: number;
    humidity: number;
    wind_speed: number;
    precipitation: number;
    weathercode: number;
};

type DailyForecast = {
    date: string;
    max: number;
    min: number;
    rain: number;
    code: number;
    sunrise: string;
    sunset: string;
};

type HourlyPoint = { hour: string; rain: number };

// ─── Page ──────────────────────────────────────────────────────────────────────
function WeatherPage() {
    const { location } = useLocation();
    const [current, setCurrent] = useState<CurrentWeather | null>(null);
    const [daily, setDaily] = useState<DailyForecast[]>([]);
    const [hourly, setHourly] = useState<HourlyPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (location.status !== "ready") return;
        const { lat, lng } = location;
        setLoading(true);
        setError(null);

        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lng));
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weathercode");
        url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,sunrise,sunset");
        url.searchParams.set("hourly", "precipitation");
        url.searchParams.set("forecast_days", "7");
        url.searchParams.set("timezone", "auto");

        fetch(url.toString())
            .then((r) => r.json())
            .then((data: {
                current?: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; precipitation: number; weathercode: number };
                daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; weathercode: number[]; sunrise: string[]; sunset: string[] };
                hourly?: { time: string[]; precipitation: number[] };
            }) => {
                if (data.current) {
                    setCurrent({
                        temperature: data.current.temperature_2m,
                        humidity: data.current.relative_humidity_2m,
                        wind_speed: data.current.wind_speed_10m,
                        precipitation: data.current.precipitation,
                        weathercode: data.current.weathercode,
                    });
                }
                if (data.daily) {
                    setDaily(
                        data.daily.time.map((date, i) => ({
                            date,
                            max: data.daily!.temperature_2m_max[i] ?? 0,
                            min: data.daily!.temperature_2m_min[i] ?? 0,
                            rain: data.daily!.precipitation_sum[i] ?? 0,
                            code: data.daily!.weathercode[i] ?? 0,
                            sunrise: (data.daily!.sunrise[i] ?? "").split("T")[1]?.slice(0, 5) ?? "-",
                            sunset: (data.daily!.sunset[i] ?? "").split("T")[1]?.slice(0, 5) ?? "-",
                        })),
                    );
                }
                if (data.hourly) {
                    // next 24 hours
                    const now = new Date();
                    const next24 = data.hourly.time
                        .map((t, i) => ({ t, rain: data.hourly!.precipitation[i] ?? 0 }))
                        .filter(({ t }) => {
                            const d = new Date(t);
                            return d >= now && d <= new Date(now.getTime() + 24 * 3600_000);
                        })
                        .map(({ t, rain }) => ({
                            hour: t.split("T")[1]?.slice(0, 5) ?? "",
                            rain,
                        }));
                    setHourly(next24);
                }
                setLoading(false);
            })
            .catch(() => {
                setError("Could not load weather data. Please check your connection.");
                setLoading(false);
            });
    }, [location]);

    if (location.status === "loading" || loading) {
        return <PageShell title="Weather Forecast"><LoadingState label="Fetching weather for your location…" /></PageShell>;
    }
    if (location.status === "error") {
        return <PageShell title="Weather Forecast"><ErrorState message={location.message} /></PageShell>;
    }
    if (location.status === "idle") {
        return <PageShell title="Weather Forecast"><ErrorState message="Allow location to view weather." /></PageShell>;
    }
    if (error) {
        return <PageShell title="Weather Forecast"><ErrorState message={error} /></PageShell>;
    }

    return (
        <PageShell title="Weather Forecast" subtitle={`7-day outlook for ${location.city}`}>
            {/* Current conditions */}
            {current && (
                <Card className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
                    <CardContent className="p-6">
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-3">
                                {wmoIcon(current.weathercode, 56)}
                                <div>
                                    <p className="text-5xl font-bold">{Math.round(current.temperature)}°C</p>
                                    <p className="mt-1 text-sm opacity-80">{wmoLabel(current.weathercode)}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-6 text-sm opacity-90">
                                <Stat icon={<Droplets size={16} />} label="Humidity" value={`${current.humidity}%`} />
                                <Stat icon={<Wind size={16} />} label="Wind" value={`${Math.round(current.wind_speed)} km/h`} />
                                <Stat icon={<CloudRain size={16} />} label="Rain now" value={`${current.precipitation} mm`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 7-day daily forecast */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {daily.map((day) => (
                    <Card key={day.date} className="text-center">
                        <CardContent className="p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                {new Date(day.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                            </p>
                            <div className="my-2 flex justify-center">{wmoIcon(day.code, 24)}</div>
                            <p className="font-semibold">{Math.round(day.max)}°</p>
                            <p className="text-xs text-muted-foreground">{Math.round(day.min)}°</p>
                            {day.rain > 0 && (
                                <p className="mt-1 text-xs text-rain font-medium">{day.rain} mm</p>
                            )}
                            <p className="mt-1 text-[10px] text-muted-foreground">☀{day.sunrise} 🌙{day.sunset}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Hourly rain */}
            {hourly.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Next 24-hour rainfall</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hourly}>
                                    <defs>
                                        <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--rain)" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="var(--rain)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={3} />
                                    <YAxis width={40} tickLine={false} axisLine={false} unit=" mm" />
                                    <Tooltip formatter={(v: number) => [`${v} mm`, "Rainfall"]} />
                                    <Area type="monotone" dataKey="rain" stroke="var(--rain)" fill="url(#rainFill)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Extra details */}
            <div className="grid gap-4 sm:grid-cols-3">
                {daily[0] && (
                    <>
                        <InfoCard label="Today's range" value={`${Math.round(daily[0].min)}° – ${Math.round(daily[0].max)}°C`} icon={<Thermometer className="text-harvest-gold" />} />
                        <InfoCard label="Today's rainfall" value={`${daily[0].rain} mm`} icon={<CloudRain className="text-rain" />} />
                        <InfoCard label="Visibility" value="Clear horizon" icon={<Eye className="text-primary" />} />
                    </>
                )}
            </div>
        </PageShell>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5">
            {icon}
            <span>{label}: <strong>{value}</strong></span>
        </div>
    );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                {icon}
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export function PageShell({
    title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <main className="min-h-screen bg-background px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold font-serif">{title}</h1>
                    {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                </header>
                {children}
            </div>
        </main>
    );
}

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

export function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex min-h-[30vh] items-center justify-center">
            <p className="rounded-xl bg-destructive/10 px-6 py-4 text-sm text-destructive max-w-md text-center">{message}</p>
        </div>
    );
}
