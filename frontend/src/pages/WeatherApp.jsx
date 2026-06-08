import { useCallback, useEffect, useMemo, useState } from "react";
import WeatherMap from "@/components/WeatherMap";
import SearchBar from "@/components/SearchBar";
import WeatherCard from "@/components/WeatherCard";
// import LayerToggles from "@/components/LayerToggles"; // Removed - free tier doesn't support map tiles
import SavedLocationsPanel from "@/components/SavedLocationsPanel";
import RainOverlay from "@/components/RainOverlay";
import ForecastPanel from "@/components/ForecastPanel";
import { fetchWeather, reverseGeocode, fetchFullForecast } from "@/lib/weatherApi";
import { useSavedLocations } from "@/hooks/useSavedLocations";
import { useTheme } from "@/hooks/useTheme";
import {
  BookmarkSimple, CrosshairSimple, Lightning, CaretDown, CaretUp, Sun, Moon,
} from "@phosphor-icons/react";
import { toast, Toaster } from "sonner";

export default function WeatherApp() {
  const [marker, setMarker] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [units, setUnits] = useState("metric");
  // const [activeLayers, setActiveLayers] = useState({ // Removed - not needed without LayerToggles
  //   clouds: false,
  //   precipitation: false,
  //   temp: false,
  //   wind: false,
  // });
  const [savedOpen, setSavedOpen] = useState(false);
  // Bottom panel can be collapsed on mobile to give more room to the map
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { saved, add, remove, isSaved } = useSavedLocations();
  const { theme, toggle: toggleTheme } = useTheme();

  const loadFor = useCallback(
    async ({ lat, lon, displayName, country }) => {
      setMarker({ lat, lon });
      setLoading(true);
      setForecastLoading(true);
      try {
        const [w, geo, fc] = await Promise.all([
          fetchWeather(lat, lon, units),
          displayName ? Promise.resolve(null) : reverseGeocode(lat, lon).catch(() => null),
          fetchFullForecast(lat, lon, units).catch(() => null),
        ]);
        const finalName = displayName || geo?.name || w.name || "Unknown";
        const finalCountry = country || geo?.country || w.country || "";
        setWeather({ ...w, name: finalName, country: finalCountry });
        setForecast(fc);
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || "Failed to fetch weather";
        toast.error(msg);
        setWeather(null);
        setForecast(null);
      } finally {
        setLoading(false);
        setForecastLoading(false);
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
    const normLon = ((lon + 540) % 360) - 180;
    loadFor({ lat, lon: normLon });
  };

  const handleSearchPick = (loc) => {
    setFlyTo({ lat: loc.lat, lon: loc.lon, zoom: 10 });
    loadFor({ lat: loc.lat, lon: loc.lon, displayName: loc.name, country: loc.country });
  };

  const handleSavedSelect = (loc) => {
    setSavedOpen(false);
    setFlyTo({ lat: loc.lat, lon: loc.lon, zoom: 10 });
    loadFor({ lat: loc.lat, lon: loc.lon, displayName: loc.name, country: loc.country });
  };

  const handleSave = () => {
    if (!weather || !marker) return;
    if (isSaved(marker.lat, marker.lon)) {
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

  // const toggleLayer = (key) => // Removed - not needed without LayerToggles
  //   setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const markerSaved = marker ? isSaved(marker.lat, marker.lon) : false;

  const rainState = useMemo(() => {
    const id = weather?.weather?.[0]?.id;
    const main = weather?.weather?.[0]?.main;
    if (!id && !main) return { active: false, intensity: "rain" };
    if (id >= 300 && id < 400) return { active: true, intensity: "drizzle" };
    if (id >= 500 && id < 600) return { active: true, intensity: "rain" };
    if (id >= 200 && id < 300) return { active: true, intensity: "rain" };
    if (main === "Rain") return { active: true, intensity: "rain" };
    if (main === "Drizzle") return { active: true, intensity: "drizzle" };
    return { active: false, intensity: "rain" };
  }, [weather]);

  const locationLabel = useMemo(
    () => (weather ? { name: weather.name, country: weather.country } : null),
    [weather]
  );

  // Create empty activeLayers object to pass to WeatherMap (all layers disabled)
  const activeLayers = { clouds: false, precipitation: false, temp: false, wind: false };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* ============ TOP HALF: MAP ============ */}
      <section
        className="relative flex-shrink-0"
        style={{ height: "55vh", minHeight: 320 }}
        data-testid="map-section"
      >
        <WeatherMap
          onClickPoint={handleMapClick}
          marker={marker}
          activeLayers={activeLayers}
          flyTo={flyTo}
          theme={theme}
        />

        <RainOverlay active={rainState.active} intensity={rainState.intensity} />

        {/* Floating header */}
        <header className="pointer-events-none absolute top-0 left-0 right-0 z-30 px-3 sm:px-6 pt-3 sm:pt-5 flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-3 glass-panel px-3 sm:px-4 py-2 sm:py-2.5">
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
              data-testid="theme-toggle"
              data-theme-state={theme}
              onClick={toggleTheme}
              className="btn-radar p-2.5 flex items-center justify-center"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun size={16} weight="bold" />
                : <Moon size={16} weight="bold" />}
            </button>
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
        <div className="md:hidden absolute top-[74px] left-0 right-0 z-30 px-3">
          <SearchBar onPick={handleSearchPick} />
        </div>

        {/* Layer toggles - REMOVED because free OpenWeatherMap tier doesn't support map tiles */}

        {/* Empty-state hint over map */}
        {!weather && !loading && (
          <div className="pointer-events-none absolute z-20 inset-x-0 bottom-3 sm:bottom-5 flex justify-center px-4">
            <div className="glass-panel px-4 py-2 animate-fade-in">
              <div className="overline text-center">
                CLICK ANYWHERE ON THE MAP TO READ HYPER-LOCAL WEATHER
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ============ BOTTOM HALF: FORECAST STACK ============ */}
      <section
        className="flex-1 min-h-0 overflow-auto border-t"
        style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
        data-testid="forecast-section"
      >
        <div className="px-3 sm:px-6 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 sm:gap-5">
          {/* LEFT: Hourly + Daily strips */}
          <div className="min-w-0 order-2 lg:order-1">
            <ForecastPanel
              forecast={forecast}
              loading={forecastLoading}
              units={units}
              location={locationLabel}
            />
          </div>

          {/* RIGHT: Current conditions card / collapsible details */}
          <div className="order-1 lg:order-2">
            {(weather || loading) ? (
              <>
                <WeatherCard
                  weather={weather}
                  loading={loading}
                  onClose={() => {
                    setWeather(null);
                    setForecast(null);
                    setMarker(null);
                  }}
                  onSave={handleSave}
                  isSaved={markerSaved}
                  units={units}
                  onToggleUnits={() =>
                    setUnits((u) => (u === "metric" ? "imperial" : "metric"))
                  }
                />
                {/* Mobile-only: collapse extra detail when needed */}
                <button
                  data-testid="toggle-details"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="md:hidden btn-radar w-full mt-2 py-2 flex items-center justify-center gap-2"
                >
                  {detailsOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
                  {detailsOpen ? "HIDE FORECAST" : "VIEW 24H & 7-DAY"}
                </button>
              </>
            ) : (
              <div className="glass-panel p-6" data-testid="current-empty">
                <div className="overline">CURRENT</div>
                <p className="font-display text-sm uppercase tracking-wider text-white/70 mt-2">
                  No location selected yet.
                </p>
                <p className="overline mt-3">
                  Tap the globe above or search for a place to see live conditions.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SavedLocationsPanel
        saved={saved}
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onSelect={handleSavedSelect}
        onRemove={remove}
      />

      <Toaster
        theme={theme}
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
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
