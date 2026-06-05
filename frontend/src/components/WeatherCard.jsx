import {
  Sun, Moon, CloudSun, Cloud, CloudRain, CloudLightning, CloudSnow,
  CloudFog, Drop, Wind, Gauge, Eye, ThermometerSimple, X, BookmarkSimple,
  ArrowUp, ArrowDown, MapPin,
} from "@phosphor-icons/react";

function iconFor(code, big = false) {
  const sz = big ? 96 : 22;
  const props = { size: sz, weight: "duotone" };
  if (!code) return <CloudSun {...props} />;
  if (code.startsWith("01")) return code.endsWith("n") ? <Moon {...props} /> : <Sun {...props} />;
  if (code.startsWith("02")) return <CloudSun {...props} />;
  if (code.startsWith("03")) return <Cloud {...props} />;
  if (code.startsWith("04")) return <Cloud {...props} />;
  if (code.startsWith("09") || code.startsWith("10")) return <CloudRain {...props} />;
  if (code.startsWith("11")) return <CloudLightning {...props} />;
  if (code.startsWith("13")) return <CloudSnow {...props} />;
  if (code.startsWith("50")) return <CloudFog {...props} />;
  return <CloudSun {...props} />;
}

function fmtTime(unix, tzOffsetSec = 0) {
  if (!unix) return "—";
  const d = new Date((unix + tzOffsetSec) * 1000);
  return d.toUTCString().split(" ")[4].slice(0, 5);
}

export default function WeatherCard({ weather, loading, onClose, onSave, isSaved, units, onToggleUnits }) {
  if (loading) {
    return (
      <div className="glass-panel p-6 animate-slide-in" data-testid="weather-card-loading">
        <div className="overline">FETCHING TELEMETRY…</div>
        <div className="mt-3 h-2 w-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#e2ff3b] animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }
  if (!weather) return null;

  const w = weather.weather?.[0] || {};
  const m = weather.main || {};
  const wind = weather.wind || {};
  const tempUnit = units === "imperial" ? "°F" : units === "standard" ? "K" : "°C";
  const windUnit = units === "imperial" ? "mph" : "m/s";

  return (
    <div
      className="glass-panel p-5 sm:p-6 animate-slide-in w-full sm:w-[380px] max-w-full"
      data-testid="weather-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="overline flex items-center gap-2">
            <MapPin size={11} weight="bold" />
            {weather.country || "—"} · {weather.coord?.lat?.toFixed(3)}, {weather.coord?.lon?.toFixed(3)}
          </div>
          <h2 className="font-display text-2xl tracking-tight uppercase text-white mt-1 truncate" data-testid="weather-location-name">
            {weather.name || "Unknown"}
          </h2>
          <div className="overline mt-1 text-white/60">{w.description || "—"}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          data-testid="weather-card-close"
          className="text-white/60 hover:text-white transition-colors p-1"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Hero metric */}
      <div className="grid grid-cols-3 gap-4 items-center border-y border-white/10 py-5">
        <div className="col-span-2">
          <div className="font-mono-tech text-6xl leading-none tracking-tighter text-white" data-testid="weather-temp">
            {Math.round(m.temp ?? 0)}
            <span className="text-2xl text-white/50 ml-1">{tempUnit}</span>
          </div>
          <div className="overline mt-2">
            FEELS LIKE {Math.round(m.feels_like ?? 0)}{tempUnit}
          </div>
        </div>
        <div className="flex justify-end text-[#e2ff3b]">{iconFor(w.icon, true)}</div>
      </div>

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-white/10 mt-5 border border-white/10">
        <Metric icon={<Wind size={16} weight="duotone" />} label="WIND" value={`${(wind.speed ?? 0).toFixed(1)} ${windUnit}`} testid="metric-wind" />
        <Metric icon={<Drop size={16} weight="duotone" />} label="HUMIDITY" value={`${m.humidity ?? 0}%`} testid="metric-humidity" />
        <Metric icon={<Gauge size={16} weight="duotone" />} label="PRESSURE" value={`${m.pressure ?? 0} hPa`} testid="metric-pressure" />
        <Metric icon={<Eye size={16} weight="duotone" />} label="VISIBILITY" value={`${weather.visibility ? (weather.visibility / 1000).toFixed(1) : "—"} km`} testid="metric-visibility" />
        <Metric icon={<ThermometerSimple size={16} weight="duotone" />} label="MIN / MAX" value={`${Math.round(m.temp_min ?? 0)}° / ${Math.round(m.temp_max ?? 0)}°`} testid="metric-minmax" />
        <Metric icon={<Cloud size={16} weight="duotone" />} label="CLOUDS" value={`${weather.clouds?.all ?? 0}%`} testid="metric-clouds" />
        <Metric icon={<ArrowUp size={16} weight="duotone" />} label="SUNRISE" value={fmtTime(weather.sys?.sunrise, weather.timezone)} testid="metric-sunrise" />
        <Metric icon={<ArrowDown size={16} weight="duotone" />} label="SUNSET" value={fmtTime(weather.sys?.sunset, weather.timezone)} testid="metric-sunset" />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 mt-5">
        <button
          data-testid="weather-save-btn"
          onClick={onSave}
          className="btn-radar flex-1 flex items-center justify-center gap-2 py-2"
          data-state={isSaved ? "on" : "off"}
        >
          <BookmarkSimple size={14} weight={isSaved ? "fill" : "bold"} />
          {isSaved ? "SAVED" : "SAVE LOCATION"}
        </button>
        <button
          data-testid="weather-units-toggle"
          onClick={onToggleUnits}
          className="btn-radar px-3 py-2"
          title="Toggle units"
        >
          {units === "metric" ? "°C" : "°F"}
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, testid }) {
  return (
    <div className="bg-black/60 px-4 py-3" data-testid={testid}>
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="overline !text-[9px]">{label}</span>
      </div>
      <div className="font-mono-tech text-base text-white mt-1.5">{value}</div>
    </div>
  );
}
