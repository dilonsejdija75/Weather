import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { tileUrl } from "@/lib/weatherApi";

// Fix default marker icon path issue in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// OWM static layer names (for temp & wind — no time-series in free tier)
const OWM_STATIC = {
  temp: "temp_new",
  wind: "wind_new",
};

// RainViewer config (free, no key) for ANIMATED radar (rain) + satellite (clouds)
const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";

export default function WeatherMap({ onClickPoint, marker, activeLayers, flyTo }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  // overlayLayersRef[key] = { type: 'animated'|'static', layer, frames, idx }
  const overlayLayersRef = useRef({});
  const animTimerRef = useRef(null);
  const [framesData, setFramesData] = useState(null);

  // Fetch RainViewer animation frames once
  useEffect(() => {
    let aborted = false;
    fetch(RAINVIEWER_API)
      .then((r) => r.json())
      .then((d) => {
        if (aborted || !d) return;
        const radar = [
          ...(d.radar?.past || []),
          ...(d.radar?.nowcast || []),
        ];
        const sat = d.satellite?.infrared || [];
        setFramesData({ host: d.host, radar, sat });
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const computeMinZoom = () => {
      const w = containerRef.current?.clientWidth || window.innerWidth;
      const h = containerRef.current?.clientHeight || window.innerHeight;
      const needed = Math.ceil(Math.log2(Math.max(w, h / 0.944) / 256));
      return Math.max(2, needed);
    };
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: Math.max(3, computeMinZoom()),
      minZoom: computeMinZoom(),
      maxZoom: 18,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: true,
      maxBounds: L.latLngBounds(L.latLng(-85, -Infinity), L.latLng(85, Infinity)),
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a> · Weather © OpenWeatherMap · Radar © RainViewer',
        subdomains: "abcd",
        maxZoom: 19,
        noWrap: false,
      }
    ).addTo(map);

    // Custom panes for animated overlays (so we can target via CSS)
    map.createPane("anim-rain");
    map.createPane("anim-clouds");
    map.createPane("anim-temp");
    map.createPane("anim-wind");
    map.getPane("anim-rain").style.zIndex = 410;
    map.getPane("anim-clouds").style.zIndex = 405;
    map.getPane("anim-temp").style.zIndex = 408;
    map.getPane("anim-wind").style.zIndex = 409;

    mapRef.current = map;

    map.on("click", (e) => {
      onClickPoint?.({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    const handleResize = () => {
      const mz = computeMinZoom();
      map.setMinZoom(mz);
      if (map.getZoom() < mz) map.setZoom(mz);
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (marker) {
      const icon = L.divIcon({
        className: "pulse-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      markerRef.current = L.marker([marker.lat, marker.lon], { icon }).addTo(map);
    }
  }, [marker]);

  // Fly to
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lon], Math.max(map.getZoom(), flyTo.zoom || 9), {
      duration: 0.9,
    });
  }, [flyTo]);

  // Build RainViewer tile URL for a given frame
  const rvUrl = (host, path, color = 2) =>
    `${host}${path}/256/{z}/{x}/{y}/${color}/1_1.png`;

  // Active overlay layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ensureAnimated = (key, framesList, paneName, color) => {
      if (!framesData || !framesList?.length) return;
      const existing = overlayLayersRef.current[key];
      if (existing) return;
      const idx = framesList.length - 1; // start at most-recent frame
      const layer = L.tileLayer(rvUrl(framesData.host, framesList[idx].path, color), {
        opacity: 0.0,
        maxZoom: 19,
        pane: paneName,
        crossOrigin: true,
      });
      layer.addTo(map);
      // Fade in
      requestAnimationFrame(() => layer.setOpacity(0.72));
      overlayLayersRef.current[key] = {
        type: "animated",
        layer,
        frames: framesList,
        idx,
        color,
      };
    };

    const ensureStatic = (key, owmName, paneName) => {
      const existing = overlayLayersRef.current[key];
      if (existing) return;
      const layer = L.tileLayer(tileUrl(owmName), {
        opacity: 0.0,
        maxZoom: 19,
        pane: paneName,
      });
      layer.addTo(map);
      requestAnimationFrame(() => layer.setOpacity(0.6));
      overlayLayersRef.current[key] = { type: "static", layer };
    };

    const remove = (key) => {
      const ex = overlayLayersRef.current[key];
      if (!ex) return;
      ex.layer.remove();
      delete overlayLayersRef.current[key];
    };

    // Precipitation -> RainViewer radar
    if (activeLayers?.precipitation) {
      ensureAnimated("precipitation", framesData?.radar, "anim-rain", 2);
    } else {
      remove("precipitation");
    }
    // Clouds -> RainViewer satellite infrared
    if (activeLayers?.clouds) {
      ensureAnimated("clouds", framesData?.sat, "anim-clouds", 0);
    } else {
      remove("clouds");
    }
    // Temp -> OWM static + CSS animation pane
    if (activeLayers?.temp) {
      ensureStatic("temp", OWM_STATIC.temp, "anim-temp");
    } else {
      remove("temp");
    }
    // Wind -> OWM static + CSS animation pane
    if (activeLayers?.wind) {
      ensureStatic("wind", OWM_STATIC.wind, "anim-wind");
    } else {
      remove("wind");
    }

    // Toggle CSS animation classes on panes
    const panes = map.getPanes();
    panes["anim-rain"].classList.toggle("anim-drift", !!activeLayers?.precipitation);
    panes["anim-clouds"].classList.toggle("anim-clouds-drift", !!activeLayers?.clouds);
    panes["anim-temp"].classList.toggle("anim-pulse", !!activeLayers?.temp);
    panes["anim-wind"].classList.toggle("anim-wind-streak", !!activeLayers?.wind);
  }, [activeLayers, framesData]);

  // Animation timer: cycle through RainViewer frames every 650ms
  useEffect(() => {
    const tick = () => {
      const map = mapRef.current;
      if (!map) return;
      ["precipitation", "clouds"].forEach((key) => {
        const entry = overlayLayersRef.current[key];
        if (!entry || entry.type !== "animated" || !entry.frames?.length) return;
        entry.idx = (entry.idx + 1) % entry.frames.length;
        const frame = entry.frames[entry.idx];
        entry.layer.setUrl(rvUrl(framesData.host, frame.path, entry.color));
      });
    };
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    if (framesData) {
      animTimerRef.current = setInterval(tick, 650);
    }
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, [framesData]);

  return (
    <div
      ref={containerRef}
      data-testid="weather-map"
      className="absolute inset-0 z-0"
      style={{ background: "#050505" }}
    />
  );
}
