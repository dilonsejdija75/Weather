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
    """Hourly (next 24h, interpolated from OWM 3-hourly) + Daily (next 5 days).

    Source: OpenWeatherMap /data/2.5/forecast (5-day / 3-hour).
    Free tier doesn't give true-hourly so we linearly interpolate temp/humidity/wind
    between the 3-hour samples and carry the nearest weather code per slot.
    """
    from collections import Counter
    from datetime import datetime, timezone as _tz, timedelta

    key = f"ff:{round(lat, 3)}:{round(lon, 3)}:{units}"
    if key in weather_cache:
        return weather_cache[key]

    url = f"{OWM_BASE}/data/2.5/forecast"
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": units}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="OWM forecast failed")
        data = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Upstream error: {e}")

    samples = data.get("list", [])  # 3-hour intervals
    if not samples:
        raise HTTPException(status_code=502, detail="Empty forecast from OWM")

    tz_offset = int(data.get("city", {}).get("timezone", 0))  # seconds

    def to_local(dt_unix: int) -> datetime:
        return datetime.fromtimestamp(dt_unix, tz=_tz.utc) + timedelta(seconds=tz_offset)

    # Build sample series (already sorted by time)
    series = []
    for s in samples:
        series.append({
            "ts": int(s["dt"]),
            "temp": float(s["main"]["temp"]),
            "humidity": int(s["main"]["humidity"]),
            "wind": float(s.get("wind", {}).get("speed", 0)),
            "pop": float(s.get("pop", 0)),
            "weather_id": int(s["weather"][0]["id"]),
            "icon": s["weather"][0]["icon"],
            "main": s["weather"][0]["main"],
            "description": s["weather"][0]["description"],
            "temp_min": float(s["main"].get("temp_min", s["main"]["temp"])),
            "temp_max": float(s["main"].get("temp_max", s["main"]["temp"])),
            "rain_3h": float(s.get("rain", {}).get("3h", 0)) if isinstance(s.get("rain"), dict) else 0,
            "snow_3h": float(s.get("snow", {}).get("3h", 0)) if isinstance(s.get("snow"), dict) else 0,
        })

    # ============ HOURLY: build 24 truly-hourly entries via linear interpolation ============
    now_ts = int(datetime.now(tz=_tz.utc).timestamp())
    # Anchor first hour at the NEXT full hour >= now (local clock alignment)
    first_local = to_local(now_ts).replace(minute=0, second=0, microsecond=0)
    # If we've already passed the start of the hour, keep this hour as "NOW"
    hourly_list = []
    for h in range(24):
        target_local = first_local + timedelta(hours=h)
        target_ts = int((target_local - timedelta(seconds=tz_offset)).timestamp())

        # Find bracketing samples
        before = None
        after = None
        for s in series:
            if s["ts"] <= target_ts:
                before = s
            elif s["ts"] > target_ts and after is None:
                after = s
                break

        if before is None and after is None:
            break
        if before is None:
            before = after
        if after is None:
            after = before

        if before["ts"] == after["ts"]:
            frac = 0.0
        else:
            frac = (target_ts - before["ts"]) / (after["ts"] - before["ts"])
            frac = max(0.0, min(1.0, frac))

        def lerp(a, b):
            return a + (b - a) * frac

        # Use nearest sample for categorical fields (weather id / icon)
        nearest = before if frac < 0.5 else after

        hourly_list.append({
            "time": target_local.strftime("%Y-%m-%dT%H:%M"),
            "dt": target_ts,
            "temp": round(lerp(before["temp"], after["temp"]), 1),
            "humidity": round(lerp(before["humidity"], after["humidity"])),
            "wind": round(lerp(before["wind"], after["wind"]), 1),
            "pop": round(lerp(before["pop"], after["pop"]), 2),
            "weather_id": nearest["weather_id"],
            "icon": nearest["icon"],
            "main": nearest["main"],
            "description": nearest["description"],
        })

    # ============ DAILY: aggregate by local date ============
    by_day: dict[str, list[dict]] = {}
    order: list[str] = []
    for s in series:
        local = to_local(s["ts"])
        date_key = local.strftime("%Y-%m-%d")
        if date_key not in by_day:
            by_day[date_key] = []
            order.append(date_key)
        by_day[date_key].append(s)

    daily_list = []
    for date_key in order[:7]:  # OWM free gives 5 days; we cap at 7
        items = by_day[date_key]
        temps = [it["temp"] for it in items]
        mins = [it["temp_min"] for it in items]
        maxs = [it["temp_max"] for it in items]
        precip = sum(it.get("rain_3h", 0) for it in items)

        # Pick the day-time sample (12:00 local if available) for icon, else most common id
        midday = None
        for it in items:
            if to_local(it["ts"]).hour in (12, 13, 14, 15):
                midday = it
                break
        if midday is None:
            ids = [it["weather_id"] for it in items]
            most_id = Counter(ids).most_common(1)[0][0]
            midday = next(it for it in items if it["weather_id"] == most_id)

        daily_list.append({
            "date": date_key,
            "weather_id": midday["weather_id"],
            "icon": midday["icon"],
            "main": midday["main"],
            "description": midday["description"],
            "max": round(max(maxs + temps), 1),
            "min": round(min(mins + temps), 1),
            "precip": round(precip, 1),
        })

    result = {
        "source": "openweathermap",
        "hourly": hourly_list,
        "daily": daily_list,
        "timezone_offset": tz_offset,
        "timezone": data.get("city", {}).get("name", ""),
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
