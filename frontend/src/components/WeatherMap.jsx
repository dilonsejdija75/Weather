import { useEffect, useRef } from "react";
import L from "leaflet";
import { tileUrl } from "@/lib/weatherApi";

// Fix default marker icon path issue in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const LAYER_DEFS = {
  clouds: "clouds_new",
  precipitation: "precipitation_new",
  temp: "temp_new",
  wind: "wind_new",
};

export default function WeatherMap({ onClickPoint, marker, activeLayers, flyTo }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const overlayLayersRef = useRef({});

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a> · Weather © OpenWeatherMap',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    mapRef.current = map;

    map.on("click", (e) => {
      onClickPoint?.({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    return () => {
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

  // Active overlay layers (clouds, precip, temp, wind)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.entries(LAYER_DEFS).forEach(([key, layerName]) => {
      const enabled = activeLayers?.[key];
      const existing = overlayLayersRef.current[key];
      if (enabled && !existing) {
        const layer = L.tileLayer(tileUrl(layerName), {
          opacity: 0.6,
          maxZoom: 19,
        });
        layer.addTo(map);
        overlayLayersRef.current[key] = layer;
      } else if (!enabled && existing) {
        existing.remove();
        delete overlayLayersRef.current[key];
      }
    });
  }, [activeLayers]);

  return (
    <div
      ref={containerRef}
      data-testid="weather-map"
      className="absolute inset-0 z-0"
      style={{ background: "#050505" }}
    />
  );
}
