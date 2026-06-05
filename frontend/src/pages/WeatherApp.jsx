import { useCallback, useEffect, useMemo, useState } from "react";
import WeatherMap from "@/components/WeatherMap";
import SearchBar from "@/components/SearchBar";
import WeatherCard from "@/components/WeatherCard";
import LayerToggles from "@/components/LayerToggles";
import SavedLocationsPanel from "@/components/SavedLocationsPanel";
import RainOverlay from "@/components/RainOverlay";
import { fetchWeather, reverseGeocode } from "@/lib/weatherApi";
import { useSavedLocations } from "@/hooks/useSavedLocations";
import { BookmarkSimple, CrosshairSimple, Lightning } from "@phosphor-icons/react";
import { toast, Toaster } from "sonner";

export default function WeatherApp() {
  const [marker, setMarker] = useState(null); // {lat, lon}
  const [flyTo, setFlyTo] = useState(null); // {lat, lon, zoom}
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState("metric");
  const [activeLayers, setActiveLayers] = useState({
    clouds: false,
    precipitation: false,
    temp: false,
    wind: false,
  });
  const [savedOpen, setSavedOpen] = useState(false);
  const { saved, add, remove, isSaved } = useSavedLocations();

  const loadFor = useCallback(
    async ({ lat, lon, displayName, country }) => {
      setMarker({ lat, lon });
      setLoading(true);
      try {
        const [w, geo] = await Promise.all([
          fetchWeather(lat, lon, units),
          displayName ? Promise.resolve(null) : reverseGeocode(lat, lon).catch(() => null),
        ]);
        const finalName = displayName || geo?.name || w.name || "Unknown";
        const finalCountry = country || geo?.country || w.country || "";
        setWeather({ ...w, name: finalName, country: finalCountry });
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || "Failed to fetch weather";
        toast.error(msg);
        setWeather(null);
      } finally {
        setLoading(false);
      }
    },
    [units]
  );

  // Refetch when units change while a marker exists
  useEffect(() => {
    if (marker) {
      loadFor({ lat: marker.lat, lon: marker.lon, displayName: weather?.name, country: weather?.country });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const handleMapClick = ({ lat, lon }) => {
    // Normalize longitude to -180..180
    const normLon = ((lon + 540) % 360) - 180;
    loadFor({ lat, lon: normLon });
  };

  const handleSearchPick = (loc) => {
    setFlyTo({ lat: loc.lat, lon: loc.lon, zoom: 10 });
    loadFor({
      lat: loc.lat,
      lon: loc.lon,
      displayName: loc.name,
      country: loc.country,
    });
  };

  const handleSavedSelect = (loc) => {
    setSavedOpen(false);
    setFlyTo({ lat: loc.lat, lon: loc.lon, zoom: 10 });
    loadFor({ lat: loc.lat, lon: loc.lon, displayName: loc.name, country: loc.country });
  };

  const handleSave = () => {
    if (!weather || !marker) return;
    const saved = isSaved(marker.lat, marker.lon);
    if (saved) {
      remove(marker.lat, marker.lon);
      toast("Removed from saved locations");
    } else {
      add({
        lat: marker.lat,
        lon: marker.lon,
        name: weather.name,
        country: weather.country,
      });
      toast.success("Saved");
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFlyTo({ lat: latitude, lon: longitude, zoom: 11 });
        loadFor({ lat: latitude, lon: longitude });
      },
      () => toast.error("Unable to access location")
    );
  };

  const toggleLayer = (key) =>
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const markerSaved = marker ? isSaved(marker.lat, marker.lon) : false;

  // Detect rain / drizzle from current weather
  // OWM weather codes: 2xx thunderstorm, 3xx drizzle, 5xx rain
  const rainState = useMemo(() => {
    const id = weather?.weather?.[0]?.id;
    const main = weather?.weather?.[0]?.main;
    if (!id && !main) return { active: false, intensity: "rain" };
    if (id >= 300 && id < 400) return { active: true, intensity: "drizzle" };
    if (id >= 500 && id < 600) return { active: true, intensity: "rain" };
    if (id >= 200 && id < 300) return { active: true, intensity: "rain" }; // thunderstorm w/ rain
    if (main === "Rain") return { active: true, intensity: "rain" };
    if (main === "Drizzle") return { active: true, intensity: "drizzle" };
    return { active: false, intensity: "rain" };
  }, [weather]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050505]">
      <WeatherMap
        onClickPoint={handleMapClick}
        marker={marker}
        activeLayers={activeLayers}
        flyTo={flyTo}
      />

      {/* Realistic rain particle overlay - activates ONLY for rain / drizzle */}
      <RainOverlay active={rainState.active} intensity={rainState.intensity} />

      {/* Top brand strip */}
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 pt-4 sm:pt-6 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex items-center gap-3 glass-panel px-4 py-2.5">
          <Lightning size={18} weight="fill" className="text-[#e2ff3b]" />
          <div>
            <div className="font-display text-sm tracking-tighter uppercase text-white leading-none">
              Hyperlocal
            </div>
            <div className="overline mt-1 leading-none">WEATHER · GRID</div>
          </div>
        </div>

        <div className="pointer-events-auto hidden md:block w-full max-w-md">
          <SearchBar onPick={handleSearchPick} />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            data-testid="locate-me-btn"
            onClick={locateMe}
            className="btn-radar p-2.5 flex items-center justify-center"
            title="Locate me"
            aria-label="Locate me"
          >
            <CrosshairSimple size={16} weight="bold" />
          </button>
          <button
            data-testid="open-saved-btn"
            onClick={() => setSavedOpen(true)}
            className="btn-radar px-3 py-2.5 flex items-center gap-2"
          >
            <BookmarkSimple size={14} weight="bold" />
            <span className="hidden sm:inline">SAVED</span>
            <span className="font-mono-tech text-white/60">[{saved.length}]</span>
          </button>
        </div>
      </header>

      {/* Mobile search row */}
      <div className="md:hidden absolute top-[78px] left-0 right-0 z-30 px-4">
        <SearchBar onPick={handleSearchPick} />
      </div>

      {/* Layer toggles - left side */}
      <div className="absolute left-4 sm:left-6 bottom-6 sm:bottom-8 z-30">
        <LayerToggles active={activeLayers} onToggle={toggleLayer} />
      </div>

      {/* Weather card - right/bottom */}
      {(weather || loading) && (
        <div
          className={`absolute z-30 right-4 sm:right-6 bottom-6 sm:bottom-8 max-w-[calc(100vw-2rem)] transition-transform duration-200 ease-out ${
            savedOpen ? "md:-translate-x-[330px]" : "translate-x-0"
          }`}
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          <WeatherCard
            weather={weather}
            loading={loading}
            onClose={() => {
              setWeather(null);
              setMarker(null);
            }}
            onSave={handleSave}
            isSaved={markerSaved}
            units={units}
            onToggleUnits={() =>
              setUnits((u) => (u === "metric" ? "imperial" : "metric"))
            }
          />
        </div>
      )}

      {/* Empty-state hint */}
      {!weather && !loading && (
        <div className="pointer-events-none absolute z-20 inset-x-0 bottom-28 flex justify-center px-4">
          <div className="glass-panel px-4 py-2 animate-fade-in">
            <div className="overline text-center">
              CLICK ANYWHERE ON THE MAP TO READ HYPER-LOCAL WEATHER
            </div>
          </div>
        </div>
      )}

      <SavedLocationsPanel
        saved={saved}
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onSelect={handleSavedSelect}
        onRemove={remove}
      />

      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(10,10,10,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            letterSpacing: "0.05em",
            borderRadius: 0,
          },
        }}
      />
    </div>
  );
}
