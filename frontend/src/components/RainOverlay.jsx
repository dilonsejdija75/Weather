import { useEffect, useRef } from "react";
import { RainEngine } from "@zakkster/lite-rain";

/**
 * Full-viewport canvas rain overlay driven by @zakkster/lite-rain.
 * - `active`  : boolean — when true, rain is rendered.
 * - `intensity`: "drizzle" | "rain" — tuned presets.
 */
export default function RainOverlay({ active, intensity = "rain" }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Preset config per intensity
    const presets = {
      drizzle: {
        gravity: 900,
        wind: 60,
        density: 1.6,
        maxSpeed: 1100,
        blurStrength: 0.025,
        splashBounce: 0.15,
        splashSpread: 90,
        splashLifeMin: 0.08,
        splashLifeMax: 0.18,
        color: "oklch(0.92 0.04 240)",
      },
      rain: {
        gravity: 1500,
        wind: 180,
        density: 4.5,
        maxSpeed: 2400,
        blurStrength: 0.045,
        splashBounce: 0.28,
        splashSpread: 200,
        splashLifeMin: 0.1,
        splashLifeMax: 0.28,
        color: "oklch(0.94 0.05 250)",
      },
    };
    const config = presets[intensity] || presets.rain;
    const maxParticles = intensity === "drizzle" ? 2500 : 8000;

    const engine = new RainEngine(maxParticles, config);
    engineRef.current = engine;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      sizeRef.current = { w, h, dpr };
    };
    updateSize();

    let scheduled = false;
    const ro = new ResizeObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        updateSize();
      });
    });
    ro.observe(document.body);

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { w, h } = sizeRef.current;

      engine.spawn(dt, w, h);
      ctx.clearRect(0, 0, w, h); // transparent overlay - map shows through
      engine.updateAndDraw(ctx, dt, w, h);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, intensity]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="rain-overlay"
      className="pointer-events-none fixed inset-0 z-20"
      aria-hidden="true"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
