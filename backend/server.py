from fastapi import FastAPI, APIRouter, HTTPException, Query, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from typing import Optional
import httpx
from cachetools import TTLCache

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

OWM_API_KEY = os.environ['OWM_API_KEY']
OWM_BASE = "https://api.openweathermap.org"
OWM_TILE_BASE = "https://tile.openweathermap.org/map"
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

# Simple in-memory cache: weather (5 min), geocode (1 hr), tiles (30 min)
weather_cache = TTLCache(maxsize=500, ttl=300)
geocode_cache = TTLCache(maxsize=1000, ttl=3600)
tile_cache = TTLCache(maxsize=2000, ttl=1800)

app = FastAPI(title="Hyper-Local Weather Map API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "hyper-local-weather"}


@api_router.get("/weather")
async def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    units: str = Query("metric", pattern="^(metric|imperial|standard)$"),
):
    """Current weather for any lat/lon. Cached 5 minutes."""
    key = f"w:{round(lat, 3)}:{round(lon, 3)}:{units}"
    if key in weather_cache:
        return weather_cache[key]

    url = f"{OWM_BASE}/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": units}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.json().get("message", "Weather fetch failed"))
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")

    result = {
        "coord": data.get("coord", {"lat": lat, "lon": lon}),
        "name": data.get("name") or "Unknown location",
        "country": data.get("sys", {}).get("country", ""),
        "weather": data.get("weather", []),
        "main": data.get("main", {}),
        "wind": data.get("wind", {}),
        "clouds": data.get("clouds", {}),
        "rain": data.get("rain", {}),
        "snow": data.get("snow", {}),
        "visibility": data.get("visibility"),
        "dt": data.get("dt"),
        "timezone": data.get("timezone", 0),
        "sys": {
            "country": data.get("sys", {}).get("country", ""),
            "sunrise": data.get("sys", {}).get("sunrise"),
            "sunset": data.get("sys", {}).get("sunset"),
        },
        "units": units,
    }
    weather_cache[key] = result
    return result


@api_router.get("/forecast")
async def get_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    units: str = Query("metric", pattern="^(metric|imperial|standard)$"),
):
    """5-day / 3-hour forecast for any lat/lon."""
    key = f"f:{round(lat, 3)}:{round(lon, 3)}:{units}"
    if key in weather_cache:
        return weather_cache[key]
    url = f"{OWM_BASE}/data/2.5/forecast"
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": units}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.json().get("message", "Forecast fetch failed"))
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")

    result = {
        "city": data.get("city", {}),
        "list": data.get("list", []),
        "units": units,
    }
    weather_cache[key] = result
    return result


@api_router.get("/geocode/reverse")
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    limit: int = Query(1, ge=1, le=5),
):
    """Returns location names (village/town/city) for given lat/lon."""
    key = f"rg:{round(lat, 4)}:{round(lon, 4)}:{limit}"
    if key in geocode_cache:
        return geocode_cache[key]
    url = f"{OWM_BASE}/geo/1.0/reverse"
    params = {"lat": lat, "lon": lon, "limit": limit, "appid": OWM_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Reverse geocode failed")
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")
    geocode_cache[key] = data
    return data


@api_router.get("/geocode/search")
async def search_geocode(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10),
):
    """Search location by name (forward geocoding)."""
    key = f"fg:{q.lower()}:{limit}"
    if key in geocode_cache:
        return geocode_cache[key]
    url = f"{OWM_BASE}/geo/1.0/direct"
    params = {"q": q, "limit": limit, "appid": OWM_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Geocode search failed")
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")
    geocode_cache[key] = data
    return data


@api_router.get("/forecast/full")
async def get_full_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    units: str = Query("metric", pattern="^(metric|imperial)$"),
):
    """Hourly (next 24h) + Daily (next 7 days) forecast via Open-Meteo (no key)."""
    key = f"ff:{round(lat, 3)}:{round(lon, 3)}:{units}"
    if key in weather_cache:
        return weather_cache[key]

    temp_unit = "fahrenheit" if units == "imperial" else "celsius"
    wind_unit = "mph" if units == "imperial" else "ms"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum",
        "forecast_days": 7,
        "forecast_hours": 24,
        "timezone": "auto",
        "temperature_unit": temp_unit,
        "wind_speed_unit": wind_unit,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(OPEN_METEO_BASE, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Open-Meteo fetch failed")
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    codes = hourly.get("weather_code", [])
    hums = hourly.get("relative_humidity_2m", [])
    winds = hourly.get("wind_speed_10m", [])
    hourly_list = []
    for i in range(min(24, len(times))):
        hourly_list.append({
            "time": times[i],
            "temp": temps[i] if i < len(temps) else None,
            "code": codes[i] if i < len(codes) else 0,
            "humidity": hums[i] if i < len(hums) else None,
            "wind": winds[i] if i < len(winds) else None,
        })

    daily = data.get("daily", {})
    d_times = daily.get("time", [])
    d_codes = daily.get("weather_code", [])
    d_max = daily.get("temperature_2m_max", [])
    d_min = daily.get("temperature_2m_min", [])
    d_sunrise = daily.get("sunrise", [])
    d_sunset = daily.get("sunset", [])
    d_precip = daily.get("precipitation_sum", [])
    daily_list = []
    for i in range(min(7, len(d_times))):
        daily_list.append({
            "date": d_times[i],
            "code": d_codes[i] if i < len(d_codes) else 0,
            "max": d_max[i] if i < len(d_max) else None,
            "min": d_min[i] if i < len(d_min) else None,
            "sunrise": d_sunrise[i] if i < len(d_sunrise) else None,
            "sunset": d_sunset[i] if i < len(d_sunset) else None,
            "precip": d_precip[i] if i < len(d_precip) else 0,
        })

    result = {
        "hourly": hourly_list,
        "daily": daily_list,
        "timezone": data.get("timezone"),
        "timezone_offset": data.get("utc_offset_seconds", 0),
        "units": units,
    }
    weather_cache[key] = result
    return result


@api_router.get("/tiles/{layer}/{z}/{x}/{y}.png")
async def proxy_tile(layer: str, z: int, x: int, y: int):
    """Proxy OWM weather tile layers so the API key stays server-side.
    layer one of: clouds_new, precipitation_new, pressure_new, wind_new, temp_new
    """
    allowed = {"clouds_new", "precipitation_new", "pressure_new", "wind_new", "temp_new"}
    if layer not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported tile layer")
    key = f"t:{layer}:{z}:{x}:{y}"
    if key in tile_cache:
        return Response(content=tile_cache[key], media_type="image/png",
                        headers={"Cache-Control": "public, max-age=1800"})
    url = f"{OWM_TILE_BASE}/{layer}/{z}/{x}/{y}.png"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params={"appid": OWM_API_KEY})
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Tile fetch failed")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")
    tile_cache[key] = r.content
    return Response(content=r.content, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=1800"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
