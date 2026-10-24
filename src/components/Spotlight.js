import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_ORDER, SUGGESTED, searchSpotlight } from '../services/spotlightSearch';
import { describeWeather, fetchWeather } from '../services/weather';
import { bangkokClock, bangkokDay, siraStatus, visitorClock } from '../services/bangkokTime';
import { SearchIcon, WeatherIcon } from './SystemIcons';
import './Spotlight.css';

const ResultIcon = ({ item, size }) =>
  item.image ? (
    <img className="spotlight-icon" src={item.image} alt="" width={size} height={size} />
  ) : (
    <span className="spotlight-icon is-emoji" style={{ width: size, height: size, fontSize: size * 0.62 }} aria-hidden="true">
      {item.emoji}
    </span>
  );

/** What Enter does with the selected result. */
const actionHint = (action) => {
  switch (action.type) {
    case 'app': return 'Open';
    case 'url': return action.url.startsWith('mailto:') ? 'Write an email' : `Open ${action.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`;
    case 'terminal': return `Show in Terminal (${action.command})`;
    case 'about': return 'Open About Sira';
    case 'island': return 'Go back to the island';
    default: return null;
  }
};

const Preview = ({ item, weather }) => {
  const now = new Date();
  const elsewhere = item.live === 'time' ? visitorClock(now) : null;
  const hint = actionHint(item.action);
  return (
    <div className="spotlight-preview">
      <div className="spotlight-preview-head">
        <ResultIcon item={item} size={52} />
        <div>
          <div className="spotlight-preview-title">{item.title}</div>
          {(item.preview?.meta || item.subtitle) && <div className="spotlight-preview-meta">{item.preview?.meta || item.subtitle}</div>}
        </div>
      </div>

      {item.live === 'weather' && (
        weather ? (
          <div className="spotlight-live">
            <WeatherIcon weather={weather} size={40} />
            {Number.isFinite(weather.temperature) && <span className="spotlight-live-big">{Math.round(weather.temperature)}°</span>}
            <div>
              <div className="spotlight-live-label">{weather.label}</div>
              <div className="spotlight-muted">
                {weather.location} · wind {Math.round(weather.wind)} m/s{weather.windFrom ? ` from the ${weather.windFrom}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div className="spotlight-muted">Checking the sky over Krabi…</div>
        )
      )}

      {item.live === 'time' && (
        <div className="spotlight-live is-time">
          <span className="spotlight-live-big">{bangkokClock(now)}</span>
          <div>
            <div className="spotlight-live-label">{bangkokDay(now)} in Bangkok</div>
            <div className="spotlight-muted">
              {elsewhere ? `${elsewhere.time} for you (${elsewhere.zone}) · ` : ''}
              {siraStatus().emoji} {siraStatus().text}
            </div>
          </div>
        </div>
      )}

      {item.preview?.lines?.length > 0 && (
        <ul className="spotlight-preview-lines">
          {item.preview.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}

      {hint && <div className="spotlight-preview-hint"><kbd>↵</kbd> {hint}</div>}
    </div>
  );
};

/**
 * Spotlight Search over the desktop: apps, projects, experience, skills,
 * education and a few actions (About Sira, back to the island, Krabi weather,
 * Bangkok time). Opened with ⌘K / Ctrl+K (⌘Space where the system doesn't take
 * it) or the menu bar's magnifier; ↑↓ to move, Enter to open, Esc to close.
 */
const Spotlight = ({ isMobile, onClose, onRun }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [weather, setWeather] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    let live = true;
    fetchWeather().then((reading) => {
      if (live) setWeather(describeWeather(reading));
    });
    return () => {
      live = false;
    };
  }, []);

  const sections = useMemo(() => {
    if (!query.trim()) return [{ title: 'Suggestions', items: SUGGESTED }];
    const results = searchSpotlight(query);
    if (results.length === 0) return [];
    const [top, ...rest] = results;
    return [
      { title: 'Top Hit', items: [top] },
      ...GROUP_ORDER.map((group) => ({ title: group, items: rest.filter((item) => item.group === group) })).filter((section) => section.items.length),
    ];
  }, [query]);
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const current = flat[Math.min(selected, flat.length - 1)];

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected, sections]);

  const run = (item) => {
    onClose();
    if (item.action.type !== 'none') onRun(item.action);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && current) {
      event.preventDefault();
      run(current);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let index = -1;
  return (
    <div
      className={`spotlight-layer ${isMobile ? 'is-mobile' : ''}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="spotlight" role="dialog" aria-label="Spotlight Search">
        <div className="spotlight-search">
          <SearchIcon size={22} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Spotlight Search"
            aria-label="Spotlight Search"
            aria-controls="spotlight-results"
            aria-activedescendant={current ? `spotlight-${current.id}` : undefined}
            role="combobox"
            aria-expanded={flat.length > 0}
            autoComplete="off"
            spellCheck="false"
          />
          {!isMobile && <kbd className="spotlight-shortcut">esc</kbd>}
        </div>

        {flat.length > 0 && (
          <div className="spotlight-body">
            <div className="spotlight-results" id="spotlight-results" role="listbox" ref={listRef}>
              {sections.map((section) => (
                <div key={section.title} className="spotlight-section">
                  <div className="spotlight-group">{section.title}</div>
                  {section.items.map((item) => {
                    index += 1;
                    const position = index;
                    return (
                      <div
                        key={`${section.title}-${item.id}`}
                        id={`spotlight-${item.id}`}
                        role="option"
                        aria-selected={item === current}
                        className={`spotlight-result ${item === current ? 'is-selected' : ''}`}
                        onPointerMove={() => setSelected(position)}
                        onClick={() => run(item)}
                      >
                        <ResultIcon item={item} size={20} />
                        <span className="spotlight-result-title">{item.title}</span>
                        {isMobile && item.subtitle && <span className="spotlight-result-subtitle">{item.subtitle}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {!isMobile && current && <Preview item={current} weather={weather} />}
          </div>
        )}

        {query.trim() && flat.length === 0 && <div className="spotlight-empty">No results for “{query.trim()}”</div>}
      </div>
    </div>
  );
};

export default Spotlight;
