import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 12000 });

export async function fetchWeather(lat, lon, units = "metric") {
  const { data } = await api.get("/weather", { params: { lat, lon, units } });
  return data;
}

export async function fetchForecast(lat, lon, units = "metric") {
  const { data } = await api.get("/forecast", { params: { lat, lon, units } });
  return data;
}

export async function fetchFullForecast(lat, lon, units = "metric") {
  // Open-Meteo via backend: 24 hourly + 7 daily
  const u = units === "imperial" ? "imperial" : "metric";
  const { data } = await api.get("/forecast/full", { params: { lat, lon, units: u } });
  return data;
}

export async function reverseGeocode(lat, lon) {
  const { data } = await api.get("/geocode/reverse", { params: { lat, lon, limit: 1 } });
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function searchLocations(q) {
  const { data } = await api.get("/geocode/search", { params: { q, limit: 6 } });
  return Array.isArray(data) ? data : [];
}

export function tileUrl(layer) {
  return `${API}/tiles/${layer}/{z}/{x}/{y}.png`;
}
