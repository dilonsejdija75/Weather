import { useEffect, useState } from "react";

const KEY = "hlw:saved_locations";

export function useSavedLocations() {
  const [saved, setSaved] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(saved));
  }, [saved]);

  const add = (loc) => {
    setSaved((prev) => {
      const dup = prev.find(
        (p) => Math.abs(p.lat - loc.lat) < 0.001 && Math.abs(p.lon - loc.lon) < 0.001
      );
      if (dup) return prev;
      return [{ ...loc, savedAt: Date.now() }, ...prev].slice(0, 30);
    });
  };

  const remove = (lat, lon) => {
    setSaved((prev) =>
      prev.filter(
        (p) => !(Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lon - lon) < 0.001)
      )
    );
  };

  const isSaved = (lat, lon) =>
    !!saved.find(
      (p) => Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lon - lon) < 0.001
    );

  return { saved, add, remove, isSaved };
}
