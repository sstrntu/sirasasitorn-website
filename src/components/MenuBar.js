import React, { useEffect, useRef, useState } from 'react';
import { PalmIcon, SearchIcon, WeatherIcon } from './SystemIcons';
import { watchWeather } from '../services/weather';
import { bangkokClock, bangkokDay, siraStatus, visitorClock } from '../services/bangkokTime';
import { DESKTOP_PROJECTS, WINDOW_NAMES } from '../data/desktopApps';
import './MenuBar.css';

/** Height of the bar (px): windows can't be dragged under it. */
export const MENU_BAR_HEIGHT = 28;

const GO_APPS = ['pdf', 'terminal', 'messages', 'notes', 'maps'];

/** The time, re-read every few seconds. */
const useNow = (ms = 5000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
};

const Item = ({ children, shortcut, checked, disabled, onSelect }) => (
  <button type="button" role="menuitem" className="menu-bar-item" disabled={disabled} onClick={onSelect}>
    <span className="menu-bar-check" aria-hidden="true">{checked ? '✓' : ''}</span>
    <span className="menu-bar-label">{children}</span>
    {shortcut && <span className="menu-bar-shortcut">{shortcut}</span>}
  </button>
);

const Separator = () => <div className="menu-bar-separator" role="separator" />;

/**
 * The Mac-style menu bar along the top of the desktop: a palm-tree menu
 * (About Sira, Spotlight, Shut Down), the front app's name, Go / Window /
 * Help menus, and Krabi's weather, Spotlight and the Bangkok clock on the
 * right. Phones get the palm menu, weather, search and clock.
 */
const MenuBar = ({
  isMobile,
  windows,
  frontmost,
  onOpenApp,
  onOpenProject,
  onFocusWindow,
  onTerminalCommand,
  onAbout,
  onSpotlight,
  onLeave,
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [weather, setWeather] = useState(null);
  const barRef = useRef(null);
  const now = useNow();

  useEffect(() => watchWeather(setWeather), []);

  useEffect(() => {
    if (!openMenu) return undefined;
    const onPointerDown = (event) => {
      if (!barRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  /** Closes the menu, then does the thing. */
  const choose = (action) => () => {
    setOpenMenu(null);
    action();
  };

  // A menu's title: click opens it; with a menu open, hovering another switches to it
  const title = (id, label, { className = '', ariaLabel } = {}) => (
    <button
      type="button"
      className={`menu-bar-title ${className} ${openMenu === id ? 'is-open' : ''}`}
      aria-haspopup="menu"
      aria-expanded={openMenu === id}
      aria-label={ariaLabel}
      onClick={() => setOpenMenu(openMenu === id ? null : id)}
      onPointerEnter={() => {
        if (openMenu && openMenu !== id) setOpenMenu(id);
      }}
    >
      {label}
    </button>
  );

  const openWindows = Object.entries(windows).filter(([, win]) => win.isOpen);
  const status = siraStatus();
  const elsewhere = visitorClock(now);

  return (
    <nav className={`menu-bar ${isMobile ? 'is-mobile' : ''}`} ref={barRef} aria-label="Menu bar">
      <div className="menu-bar-side">
        <div className="menu-bar-menu-wrap">
          {title('system', <PalmIcon size={15} />, { className: 'is-icon', ariaLabel: 'Island menu' })}
          {openMenu === 'system' && (
            <div className="menu-bar-menu" role="menu">
              <Item onSelect={choose(onAbout)}>About Sira</Item>
              <Separator />
              <Item shortcut="⌘K" onSelect={choose(onSpotlight)}>Spotlight Search</Item>
              <Separator />
              <Item onSelect={choose(onLeave)}>Shut Down…</Item>
            </div>
          )}
        </div>

        {!isMobile && (
          <>
            <span className="menu-bar-app">{frontmost ? WINDOW_NAMES[frontmost] : 'Finder'}</span>

            <div className="menu-bar-menu-wrap">
              {title('go', 'Go')}
              {openMenu === 'go' && (
                <div className="menu-bar-menu" role="menu">
                  {GO_APPS.map((id) => (
                    <Item key={id} onSelect={choose(() => onOpenApp(id))}>
                      {id === 'pdf' ? 'Résumé' : WINDOW_NAMES[id]}
                    </Item>
                  ))}
                  <Separator />
                  {DESKTOP_PROJECTS.map((project) => (
                    <Item key={project.name} shortcut="↗" onSelect={choose(() => onOpenProject(project.name, project.url))}>
                      {project.name}
                    </Item>
                  ))}
                  <Separator />
                  <Item onSelect={choose(onLeave)}>Campsite</Item>
                </div>
              )}
            </div>

            <div className="menu-bar-menu-wrap">
              {title('window', 'Window')}
              {openMenu === 'window' && (
                <div className="menu-bar-menu" role="menu">
                  {openWindows.length === 0 && <Item disabled>No Windows</Item>}
                  {openWindows.map(([id]) => (
                    <Item key={id} checked={id === frontmost} onSelect={choose(() => onFocusWindow(id))}>
                      {WINDOW_NAMES[id]}
                    </Item>
                  ))}
                </div>
              )}
            </div>

            <div className="menu-bar-menu-wrap">
              {title('help', 'Help')}
              {openMenu === 'help' && (
                <div className="menu-bar-menu" role="menu">
                  <Item shortcut="⌘K" onSelect={choose(onSpotlight)}>Search…</Item>
                  <Item onSelect={choose(() => onTerminalCommand('help'))}>Terminal Commands</Item>
                  <Item onSelect={choose(() => onOpenApp('pdf'))}>Sira’s Résumé</Item>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="menu-bar-side">
        {weather && (
          <div className="menu-bar-menu-wrap">
            {title(
              'weather',
              <>
                <WeatherIcon weather={weather} size={16} />
                {Number.isFinite(weather.temperature) && <span>{Math.round(weather.temperature)}°</span>}
              </>,
              { className: 'is-status', ariaLabel: `Krabi weather: ${weather.label}` }
            )}
            {openMenu === 'weather' && (
              <div className="menu-bar-menu menu-bar-panel is-right" role="menu">
                <div className="menu-bar-panel-place">{weather.location}{weather.preview ? ' (preview)' : ''}</div>
                <div className="menu-bar-weather">
                  <WeatherIcon weather={weather} size={38} />
                  {Number.isFinite(weather.temperature) && <span className="menu-bar-weather-temp">{Math.round(weather.temperature)}°</span>}
                  <div>
                    <div className="menu-bar-weather-label">{weather.label}</div>
                    <div className="menu-bar-muted">
                      Wind {Math.round(weather.wind)} m/s{weather.windFrom ? ` from the ${weather.windFrom}` : ''}
                    </div>
                  </div>
                </div>
                <div className="menu-bar-muted">
                  Cloud cover {Math.round(weather.cloud * 100)}%{weather.time ? ` · updated ${weather.time.slice(11, 16)}` : ''}
                </div>
                <Separator />
                <div className="menu-bar-muted">The island has the same weather right now.</div>
              </div>
            )}
          </div>
        )}

        <button type="button" className="menu-bar-title is-icon" aria-label="Spotlight Search (⌘K)" title="Spotlight Search (⌘K)" onClick={onSpotlight}>
          <SearchIcon size={14} />
        </button>

        <div className="menu-bar-menu-wrap">
          {title('clock', (
            <>
              {!isMobile && <span>{bangkokDay(now)}</span>}
              <span>{bangkokClock(now)}</span>
            </>
          ), {
            className: 'is-status is-clock',
            ariaLabel: `Bangkok time ${bangkokClock(now)}`,
          })}
          {openMenu === 'clock' && (
            <div className="menu-bar-menu menu-bar-panel is-right" role="menu">
              <div className="menu-bar-clock-row">
                <div>
                  <div className="menu-bar-weather-label">Bangkok, Thailand</div>
                  <div className="menu-bar-muted">Sira’s time · UTC+7</div>
                </div>
                <span className="menu-bar-clock-big">{bangkokClock(now)}</span>
              </div>
              {elsewhere && (
                <div className="menu-bar-clock-row">
                  <div>
                    <div className="menu-bar-weather-label">{elsewhere.zone}</div>
                    <div className="menu-bar-muted">Your time</div>
                  </div>
                  <span className="menu-bar-clock-big">{elsewhere.time}</span>
                </div>
              )}
              <Separator />
              <div className="menu-bar-muted">{status.emoji} At camp: {status.text.charAt(0).toLowerCase() + status.text.slice(1)}</div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default MenuBar;
