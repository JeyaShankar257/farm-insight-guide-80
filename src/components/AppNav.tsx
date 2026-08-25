import { Link } from "@tanstack/react-router";
import { CloudSun, Droplets, Layers, Leaf, Loader2, MapPin, ShieldAlert, Sprout } from "lucide-react";
import { useLocation } from "@/lib/location";

const NAV_LINKS = [
    { to: "/", label: "Dashboard", icon: <Sprout size={15} /> },
    { to: "/weather", label: "Weather", icon: <CloudSun size={15} /> },
    { to: "/soil", label: "Soil", icon: <Layers size={15} /> },
    { to: "/prices", label: "Prices", icon: <Leaf size={15} /> },
    { to: "/pest", label: "Pest & Disease", icon: <ShieldAlert size={15} /> },
    { to: "/irrigation", label: "Irrigation", icon: <Droplets size={15} /> },
] as const;

export function AppNav() {
    const { location, request } = useLocation();

    return (
        <nav className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
                {/* Logo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                        <Sprout size={16} />
                    </div>
                    <span className="font-serif text-base font-semibold hidden sm:block">AgriInsight</span>
                </div>

                {/* Nav links */}
                <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
                            activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
                            activeOptions={{ exact: link.to === "/" }}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Location badge */}
                <div className="flex-shrink-0">
                    {location.status === "loading" && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            <Loader2 size={11} className="animate-spin" /> Locating…
                        </span>
                    )}
                    {location.status === "ready" && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary font-medium">
                            <MapPin size={11} /> {location.city}
                        </span>
                    )}
                    {(location.status === "error" || location.status === "idle") && (
                        <button
                            onClick={request}
                            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                        >
                            <MapPin size={11} /> Allow location
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
