import React, { useEffect, useRef, useState } from 'react';
import { DISCOVERIES, getFound, on } from './utils/play';

const TOAST_MS = 3600;

/**
 * Overlay for the island's interactions: a "n / total found" badge that opens
 * a checklist (with hints for what's left), and toasts when something new is
 * discovered or the scene has a tip (e.g. how to relight the fire).
 */
const PlayHud = ({ visible }) => {
  const [found, setFound] = useState(() => new Set(getFound()));
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef();

  useEffect(() => {
    const show = (next) => {
      clearTimeout(timer.current);
      setToast({ ...next, key: Date.now() });
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    };
    const offDiscover = on('discover', ({ label }) => {
      const now = new Set(getFound());
      setFound(now);
      show({ text: label, count: now.size });
    });
    const offToast = on('toast', ({ text }) => show({ text }));
    return () => {
      offDiscover();
      offToast();
      clearTimeout(timer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {toast && (
        <div key={toast.key} className={`play-toast ${toast.count ? 'is-discovery' : ''}`} role="status">
          {toast.count ? <span className="play-toast-badge">✦ {toast.count}/{DISCOVERIES.length}</span> : null}
          {toast.text}
        </div>
      )}

      <div className="play-hud">
        {open && (
          <ul className="play-list" id="play-list">
            {DISCOVERIES.map((d) => {
              const done = found.has(d.id);
              return (
                <li key={d.id} className={done ? 'is-done' : ''}>
                  <span className="play-check" aria-hidden="true">{done ? '✓' : '·'}</span>
                  <span>{done ? d.label : d.hint}</span>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          className="jungle-button play-badge"
          aria-expanded={open}
          aria-controls="play-list"
          onClick={() => setOpen((v) => !v)}
        >
          ✦ {found.size} / {DISCOVERIES.length} found
        </button>
      </div>
    </>
  );
};

export default PlayHud;
