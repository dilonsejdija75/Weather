"""Backend tests for Hyper-Local Weather Map API."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://map-tap-forecast.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
PARIS = {"lat": 48.8566, "lon": 2.3522}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# -- Health --
def test_root_status_ok(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


# -- Weather --
def test_weather_paris(client):
    r = client.get(f"{API}/weather", params=PARIS)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == "Paris"
    assert "temp" in d["main"]
    assert "wind" in d and isinstance(d["wind"], dict)
    assert "clouds" in d
    assert d["sys"]["sunrise"] is not None
    assert d["sys"]["sunset"] is not None


def test_weather_invalid_lat(client):
    r = client.get(f"{API}/weather", params={"lat": 999, "lon": 2.3})
    assert r.status_code == 422


def test_weather_cache_fast_second_call(client):
    # first
    t0 = time.time(); r1 = client.get(f"{API}/weather", params=PARIS); d1 = time.time() - t0
    assert r1.status_code == 200
    # second
    t0 = time.time(); r2 = client.get(f"{API}/weather", params=PARIS); d2 = time.time() - t0
    assert r2.status_code == 200
    # cached second call should be noticeably faster (< 0.5s typical)
    assert d2 < max(d1, 0.5)


# -- Forecast --
def test_forecast_paris(client):
    r = client.get(f"{API}/forecast", params=PARIS)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d.get("list"), list) and len(d["list"]) > 1
    assert isinstance(d.get("city"), dict)


# -- Reverse Geocode --
def test_reverse_geocode_paris(client):
    r = client.get(f"{API}/geocode/reverse", params={**PARIS, "limit": 3})
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1
    names = " ".join((it.get("name") or "") for it in arr).lower()
    assert "paris" in names


# -- Search Geocode --
def test_search_geocode_tokyo(client):
    r = client.get(f"{API}/geocode/search", params={"q": "tokyo"})
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1
    item = arr[0]
    assert "lat" in item and "lon" in item and "country" in item


# -- Tiles proxy --
def test_tile_valid_layer(client):
    r = client.get(f"{API}/tiles/clouds_new/3/4/2.png")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("image/png")
    assert len(r.content) > 100


def test_tile_invalid_layer(client):
    r = client.get(f"{API}/tiles/invalid_layer/3/4/2.png")
    assert r.status_code == 400


# -- Key leakage --
def test_api_key_not_in_responses(client):
    """Ensure the OWM API key never leaks through any response."""
    KEY = "4b83f5b3263a9d1490329c9de9778e84"
    for path, params in [
        ("/weather", PARIS), ("/forecast", PARIS),
        ("/geocode/reverse", PARIS), ("/geocode/search", {"q": "tokyo"})
    ]:
        r = client.get(f"{API}{path}", params=params)
        assert KEY not in r.text, f"API key leaked in {path}"
