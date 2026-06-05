import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X, Spinner } from "@phosphor-icons/react";
import { searchLocations } from "@/lib/weatherApi";

export default function SearchBar({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const list = await searchLocations(q.trim());
        setResults(list);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (loc) => {
    setOpen(false);
    setQ(`${loc.name}${loc.country ? ", " + loc.country : ""}`);
    onPick?.({ lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country, state: loc.state });
  };

  return (
    <div ref={wrapperRef} className="relative w-full" data-testid="search-wrapper">
      <div className="glass-panel flex items-center gap-3 px-4 py-3">
        <MagnifyingGlass size={18} weight="bold" className="text-white/70" />
        <input
          data-testid="search-input"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="SEARCH ANY VILLAGE, TOWN OR CITY…"
          className="flex-1 bg-transparent outline-none text-sm font-mono-tech tracking-wider placeholder:text-white/30 text-white"
        />
        {loading && <Spinner size={16} className="animate-spin text-white/60" />}
        {q && !loading && (
          <button
            data-testid="search-clear"
            onClick={() => {
              setQ("");
              setResults([]);
              setOpen(false);
            }}
            className="text-white/50 hover:text-white"
            aria-label="Clear search"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          data-testid="search-results"
          className="glass-panel mt-2 max-h-72 overflow-auto animate-fade-in"
        >
          {results.map((r, idx) => (
            <button
              key={`${r.lat}-${r.lon}-${idx}`}
              data-testid={`search-result-${idx}`}
              onClick={() => pick(r)}
              className="w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
            >
              <div className="font-display text-sm tracking-tight text-white">
                {r.name}
                {r.state ? <span className="text-white/50">, {r.state}</span> : null}
              </div>
              <div className="overline mt-1">
                {r.country} · {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && q.trim().length >= 2 && results.length === 0 && (
        <div className="glass-panel mt-2 px-4 py-3 overline" data-testid="search-empty">
          No locations match "{q}"
        </div>
      )}
    </div>
  );
}
