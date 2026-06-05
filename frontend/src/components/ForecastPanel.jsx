import {
  Sun, Moon, CloudSun, Cloud, CloudRain, CloudLightning, CloudSnow,
  CloudFog, Drop,
} from "@phosphor-icons/react";

// WMO weather code → { icon, label }
// https://open-meteo.com/en/docs (weather_code mapping)
export function wmoMeta(code, isNight = false) {
  if (code === 0) return { Icon: isNight ? Moon : Sun, label: "Clear" };
  if (code === 1) return { Icon: isNight ? Moon : Sun, label: "Mostly clear" };
  if (code === 2) return { Icon: CloudSun, label: "Partly cloudy" };
  if (code === 3) return { Icon: Cloud, label: "Overcast" };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: "Fog" };
  if (code >= 51 && code <= 57) return { Icon: Drop, label: "Drizzle" };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, label: "Rain" };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: "Snow" };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: "Showers" };
  if (code >= 85 && code <= 86) return { Icon: CloudSnow, label: "Snow showers" };
  if (code === 95) return { Icon: CloudLightning, label: "Thunderstorm" };
  if (code === 96 || code === 99) return { Icon: CloudLightning, label: "Hail storm" };
  return { Icon: Cloud, label: "—" };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtHour(iso) {
  // "2026-06-05T13:00" → "13:00"
  if (!iso) return "—";
  const t = iso.split("T")[1] || "";
  return t.slice(0, 5);
}

function fmtDayName(iso, idx) {
  if (!iso) return "—";
  // Parse YYYY-MM-DD as local-naive
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if (idx === 0) return "Today";
  if (idx === 1) return "Tom";
  return DAY_NAMES[date.getDay()];
}

function fmtDayDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}`;
}

export default function ForecastPanel({ forecast, loading, units, location }) {
  const tempUnit = units === "imperial" ? "°F" : "°C";

  if (loading) {
    return (
      <div className="glass-panel p-5" data-testid="forecast-loading">
        <div className="overline">FETCHING FORECAST…</div>
        <div className="mt-3 h-1 w-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#e2ff3b] animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="glass-panel p-6" data-testid="forecast-empty">
        <div className="overline">FORECAST</div>
        <p className="font-display text-sm uppercase tracking-wider text-white/70 mt-2">
          Click any point on the map or search a location to load the hourly & 7-day outlook.
        </p>
      </div>
    );
  }

  const { hourly = [], daily = [] } = forecast;

  // Determine the current hour to highlight
  // Use device local time formatted HH:00 (forecast times are local to that timezone).
  // We highlight the closest match by index in the hourly array — first entry is "now" anyway.
  const currentIdx = 0;

  return (
    <div className="glass-panel p-4 sm:p-5" data-testid="forecast-panel">
      {/* Hourly row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="overline">NEXT 24 HOURS</div>
          {location?.name ? (
            <div className="font-display text-base sm:text-lg tracking-tight uppercase text-white mt-0.5">
              {location.name}
              {location.country ? <span className="text-white/40">, {location.country}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="overline">{forecast.timezone || ""}</div>
      </div>

      <div
        className="flex overflow-x-auto gap-2 pb-3 -mx-1 px-1"
        data-testid="hourly-strip"
        style={{ scrollbarWidth: "thin" }}
      >
        {hourly.map((h, idx) => {
          const hour = parseInt((h.time?.split("T")[1] || "00:00").slice(0, 2), 10);
          const isNight = hour < 6 || hour >= 20;
          const { Icon, label } = wmoMeta(h.code, isNight);
          const active = idx === currentIdx;
          return (
            <div
              key={h.time}
              data-testid={`hour-card-${idx}`}
              data-state={active ? "now" : "future"}
              className={`flex-shrink-0 w-[78px] sm:w-[86px] flex flex-col items-center px-2 py-3 border ${
                active
                  ? "bg-[#e2ff3b] text-[#050505] border-[#e2ff3b]"
                  : "bg-black/40 text-white border-white/10 hover:border-white/40"
              } transition-colors`}
              title={label}
            >
              <div
                className={`overline ${active ? "!text-[#050505] !opacity-90" : ""}`}
              >
                {active ? "NOW" : fmtHour(h.time)}
              </div>
              <Icon
                size={26}
                weight="duotone"
                className={`my-2 ${active ? "" : "text-white/90"}`}
              />
              <div className="font-mono-tech text-lg leading-none">
                {Math.round(h.temp ?? 0)}°
              </div>
              <div className={`overline mt-1 !text-[9px] truncate w-full text-center ${active ? "!text-[#050505] !opacity-80" : ""}`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily row */}
      <div className="border-t border-white/10 mt-2 pt-3">
        <div className="overline mb-2">7-DAY OUTLOOK</div>
        <div
          className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1"
          data-testid="daily-strip"
        >
          {daily.map((d, idx) => {
            const { Icon, label } = wmoMeta(d.code, false);
            const active = idx === 0;
            return (
              <div
                key={d.date}
                data-testid={`day-card-${idx}`}
                data-state={active ? "today" : "future"}
                className={`flex-shrink-0 w-[112px] sm:w-[128px] px-3 py-3 border ${
                  active
                    ? "bg-white text-[#050505] border-white"
                    : "bg-black/40 text-white border-white/10 hover:border-white/40"
                } transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className={`overline ${active ? "!text-[#050505] !opacity-90" : ""}`}>
                    {fmtDayName(d.date, idx)}
                  </div>
                  <div className={`overline ${active ? "!text-[#050505] !opacity-60" : "!opacity-60"}`}>
                    {fmtDayDate(d.date)}
                  </div>
                </div>
                <Icon
                  size={30}
                  weight="duotone"
                  className={`my-2 ${active ? "" : "text-[#e2ff3b]"}`}
                />
                <div className="font-mono-tech text-base leading-none">
                  <span className="text-current">{Math.round(d.max ?? 0)}{tempUnit}</span>
                  <span className={`${active ? "text-[#050505]/60" : "text-white/40"} ml-2`}>
                    {Math.round(d.min ?? 0)}°
                  </span>
                </div>
                <div className={`overline mt-2 !text-[9px] truncate ${active ? "!text-[#050505] !opacity-80" : ""}`}>
                  {label}
                </div>
                {d.precip > 0 ? (
                  <div className={`flex items-center gap-1 mt-1 font-mono-tech text-[10px] ${active ? "text-[#050505]/70" : "text-[#00ffff]/70"}`}>
                    <Drop size={10} weight="fill" />
                    {d.precip.toFixed(1)} mm
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
