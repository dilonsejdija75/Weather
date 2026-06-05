# Hyper-Local Weather Map - PRD

## Problem Statement
Build an interactive weather application that displays real-time weather data for any clickable location on a world map – not just pre-listed cities. Covers villages, towns, and remote areas via lat/lon-based OpenWeatherMap queries. The OWM API key MUST be hidden via a backend proxy.

## Architecture
- Backend: FastAPI proxy at /api/* — endpoints: /weather, /forecast, /geocode/reverse, /geocode/search, /tiles/{layer}/{z}/{x}/{y}.png. Key stored in backend/.env (OWM_API_KEY). In-memory TTL caching (weather 5min, geocode 1hr, tiles 30min).
- Frontend: React + Leaflet (CartoDB Dark Matter tiles) + Phosphor icons.
- No auth, localStorage for saved locations.

## Implemented (2026-02)
- Click-anywhere weather card with temp, feels-like, humidity, wind, pressure, visibility, min/max, clouds, sunrise/sunset
- Search bar with debounced forward geocoding + dropdown suggestions
- Weather overlays (clouds, precipitation, temp, wind) toggled via proxy-tile layer
- Saved locations slide-out panel (localStorage), add/remove/select
- Locate-me (browser geolocation)
- Units toggle (°C / °F) with auto-refetch
- Animated pulsing yellow marker, dark Swiss/Command-Center aesthetic, Chivo + JetBrains Mono + IBM Plex Sans
- Responsive: mobile gets stacked search row + bottom card

## Backlog (P1/P2)
- P1: 7-day forecast section in card (data already wired via /forecast)
- P1: Weather alerts banner for active warnings
- P2: Offline cache of last-viewed locations
- P2: Animated weather radar timelapse
- P2: Share-location URL deep link

## Next Tasks
- Wire forecast endpoint into the card UI when user expands the card
- Add deep-link `?lat=&lon=` so users can share coordinates
