import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

export type LocationState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; lat: number; lng: number; city: string }
    | { status: "error"; message: string };

const LocationContext = createContext<{
    location: LocationState;
    request: () => void;
} | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
    const [location, setLocation] = useState<LocationState>({ status: "idle" });

    const request = useCallback(() => {
        if (!navigator.geolocation) {
            setLocation({ status: "error", message: "Geolocation is not supported by your browser." });
            return;
        }
        setLocation({ status: "loading" });
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                // Reverse-geocode using Nominatim (free, no key)
                let city = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                        { headers: { "Accept-Language": "en" } },
                    );
                    if (res.ok) {
                        const data = (await res.json()) as {
                            address?: { city?: string; town?: string; village?: string; state?: string };
                        };
                        const addr = data.address;
                        city =
                            addr?.city ?? addr?.town ?? addr?.village ?? addr?.state ?? city;
                    }
                } catch {
                    /* ignore, use coordinates as city */
                }
                setLocation({ status: "ready", lat, lng, city });
            },
            (err) => {
                setLocation({
                    status: "error",
                    message:
                        err.code === 1
                            ? "Location access denied. Please allow location in your browser settings."
                            : "Could not determine your location. Please try again.",
                });
            },
            { timeout: 10000, maximumAge: 300_000 },
        );
    }, []);

    // Auto-request on first mount
    useEffect(() => {
        request();
    }, [request]);

    return (
        <LocationContext.Provider value={{ location, request }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const ctx = useContext(LocationContext);
    if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
    return ctx;
}
