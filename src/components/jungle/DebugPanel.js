import React, { useEffect, useRef, useState } from 'react';
import { formatHour, phaseName } from './timeOfDay';

const PRESETS = [
  { label: 'Sunrise', hour: 6.6 },
  { label: 'Noon', hour: 12.5 },
  { label: 'Sunset', hour: 18.35 },
  { label: 'Night', hour: 23 },
];

// In-scene hours that pass per real second while "Play day" is running
const CYCLE_SPEED = 1.2;

/** True when the page was opened with `?debug` (or `?debug=1`). */
export const isDebugMode = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

const useFps = () => {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
};

/**
 * Debug overlay (enabled with `?debug`): scrub the time of day, jump to
 * presets, fast-forward a full day, or return to Bangkok time.
 */
const DebugPanel = ({ hour, isOverridden, setOverride }) => {
  const [playing, setPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hourRef = useRef(hour);
  const fps = useFps();
  hourRef.current = hour;

  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setOverride((hourRef.current + dt * CYCLE_SPEED) % 24);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, setOverride]);

  const pick = (h) => {
    setPlaying(false);
    setOverride(h);
  };

  if (collapsed) {
    return (
      <button type="button" className="jungle-debug jungle-debug-collapsed" onClick={() => setCollapsed(false)}>
        Debug · {formatHour(hour)}
      </button>
    );
  }

  return (
    <div className="jungle-debug" role="region" aria-label="Scene debug controls">
      <div className="jungle-debug-header">
        <strong>Debug</strong>
        <span className="jungle-debug-fps">{fps} fps</span>
        <button type="button" className="jungle-debug-close" aria-label="Collapse debug panel" onClick={() => setCollapsed(true)}>
          –
        </button>
      </div>

      <div className="jungle-debug-time">
        <span className="jungle-debug-clock">{formatHour(hour)}</span>
        <span className="jungle-debug-phase">
          {phaseName(hour)}
          {!isOverridden && ' · Bangkok time'}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="23.99"
        step="0.05"
        value={hour}
        aria-label="Time of day"
        onChange={(e) => pick(Number(e.target.value))}
      />

      <div className="jungle-debug-row">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => pick(p.hour)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="jungle-debug-row">
        <button type="button" onClick={() => setPlaying((v) => !v)}>
          {playing ? '❚❚ Pause' : '▶ Play day'}
        </button>
        <button
          type="button"
          disabled={!isOverridden && !playing}
          onClick={() => {
            setPlaying(false);
            setOverride(null);
          }}
        >
          Bangkok time
        </button>
      </div>
    </div>
  );
};

export default DebugPanel;
