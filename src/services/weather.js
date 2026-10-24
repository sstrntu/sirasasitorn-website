/*
 * Krabi's current weather (Railay, where the island is set) from the backend's
 * /api/weather (Open-Meteo, cached there), shared by the home scene and the
 * desktop's menu bar. `?weather=` previews a condition without the network:
 * clear, cloudy, overcast, fog, drizzle, rain or storm.
 */

const REFRESH_MS = 10 * 60 * 1000;
const STORAGE_KEY = 'krabi-weather';

/** Same backend the chat uses: the configured URL, the dev server on :8007, or this site. */
const apiBase = () => {
  const configured = (process.env.REACT_APP_API_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return `http://${window.location.hostname}:8007`;
  return '';
};

/** WMO weather codes -> what the scene shows. `rain` is the intensity (0–1). */
const CONDITIONS = {
  0: { kind: 'clear', label: 'Clear', dayLabel: 'Sunny', rain: 0 },
  1: { kind: 'clear', label: 'Mostly clear', dayLabel: 'Mostly sunny', rain: 0 },
  2: { kind: 'cloudy', label: 'Partly cloudy', rain: 0 },
  3: { kind: 'overcast', label: 'Overcast', rain: 0 },
  45: { kind: 'fog', label: 'Fog', rain: 0 },
  48: { kind: 'fog', label: 'Fog', rain: 0 },
  51: { kind: 'drizzle', label: 'Light drizzle', rain: 0.15 },
  53: { kind: 'drizzle', label: 'Drizzle', rain: 0.25 },
  55: { kind: 'drizzle', label: 'Heavy drizzle', rain: 0.35 },
  56: { kind: 'drizzle', label: 'Drizzle', rain: 0.2 },
  57: { kind: 'drizzle', label: 'Drizzle', rain: 0.3 },
  61: { kind: 'rain', label: 'Light rain', rain: 0.45 },
  63: { kind: 'rain', label: 'Rain', rain: 0.65 },
  65: { kind: 'rain', label: 'Heavy rain', rain: 0.9 },
  66: { kind: 'rain', label: 'Rain', rain: 0.5 },
  67: { kind: 'rain', label: 'Heavy rain', rain: 0.85 },
  80: { kind: 'rain', label: 'Light showers', rain: 0.4 },
  81: { kind: 'rain', label: 'Showers', rain: 0.65 },
  82: { kind: 'rain', label: 'Heavy showers', rain: 1 },
  95: { kind: 'storm', label: 'Thunderstorm', rain: 0.85 },
  96: { kind: 'storm', label: 'Thunderstorm', rain: 1 },
  99: { kind: 'storm', label: 'Thunderstorm', rain: 1 },
};
// Snow codes (never in Krabi) fall back to overcast
const OVERCAST = CONDITIONS[3];

/** Readings for `?weather=` previews. */
const PREVIEWS = {
  clear: { weatherCode: 0, cloudCover: 5, windSpeed: 2 },
  cloudy: { weatherCode: 2, cloudCover: 55, windSpeed: 3 },
  overcast: { weatherCode: 3, cloudCover: 95, windSpeed: 3 },
  fog: { weatherCode: 45, cloudCover: 100, windSpeed: 1 },
  drizzle: { weatherCode: 53, cloudCover: 90, windSpeed: 3 },
  rain: { weatherCode: 63, cloudCover: 100, windSpeed: 5 },
  storm: { weatherCode: 95, cloudCover: 100, windSpeed: 9 },
};

const previewName = () => {
  if (typeof window === 'undefined') return null;
  const name = new URLSearchParams(window.location.search).get('weather');
  return name && PREVIEWS[name] ? name : null;
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * A reading from /api/weather, described for display and for the scene:
 * kind, label, rain (0–1), cloud (0–1), wind and gusts (m/s), temperature (°C).
 */
export const describeWeather = (reading) => {
  if (!reading) return null;
  const condition = CONDITIONS[reading.weatherCode] || OVERCAST;
  const isDay = reading.isDay !== false;
  const cloudCover = Number.isFinite(reading.cloudCover) ? reading.cloudCover / 100 : 0.3;
  // Rain falls from a full sky, whatever the cover number says
  const cloud = Math.max(cloudCover, condition.rain > 0 || condition.kind === 'fog' ? 0.85 : 0, condition.kind === 'overcast' ? 0.8 : 0);
  return {
    kind: condition.kind,
    label: isDay && condition.dayLabel ? condition.dayLabel : condition.label,
    code: reading.weatherCode,
    rain: condition.rain,
    cloud,
    fog: condition.kind === 'fog',
    isDay,
    temperature: reading.temperature,
    wind: Number.isFinite(reading.windSpeed) ? reading.windSpeed : 2,
    gusts: Number.isFinite(reading.windGusts) ? reading.windGusts : null,
    windFrom: Number.isFinite(reading.windDirection) ? COMPASS[Math.round(reading.windDirection / 45) % 8] : null,
    location: reading.location || 'Railay, Krabi',
    time: reading.time || null,
    preview: Boolean(reading.preview),
  };
};

let current = null;
let fetchedAt = 0;
let inFlight = null;

const readStored = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (stored && Date.now() - stored.fetchedAt < REFRESH_MS) {
      current = stored.reading;
      fetchedAt = stored.fetchedAt;
    }
  } catch (error) {
    // Storage blocked or empty: fetch instead
  }
};

/** The latest reading (cached for REFRESH_MS, shared across the page and reloads in this tab), or null. */
export const fetchWeather = async () => {
  const preview = previewName();
  if (preview) return { ...PREVIEWS[preview], isDay: true, location: 'Railay, Krabi', preview: true };
  if (!current) readStored();
  if (current && Date.now() - fetchedAt < REFRESH_MS) return current;
  if (!inFlight) {
    inFlight = fetch(`${apiBase()}/api/weather`)
      .then((response) => (response.ok ? response.json() : null))
      .then((reading) => {
        if (reading && Number.isFinite(reading.weatherCode)) {
          current = reading;
          fetchedAt = Date.now();
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ reading, fetchedAt }));
          } catch (error) {
            // Not stored: the next page load fetches again
          }
        }
        return current;
      })
      .catch(() => current)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

/**
 * Calls `onWeather(described)` now (once a reading arrives) and again every
 * REFRESH_MS while the page is visible. Returns a function that stops it.
 */
export const watchWeather = (onWeather) => {
  let stopped = false;
  let timer;
  const update = async () => {
    const reading = await fetchWeather();
    if (!stopped && reading) onWeather(describeWeather(reading));
  };
  const schedule = () => {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') update();
    }, REFRESH_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - fetchedAt >= REFRESH_MS) update();
  };
  update();
  schedule();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
};
