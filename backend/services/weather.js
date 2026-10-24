/**
 * Current weather at Railay, Krabi (the island scene's real-world spot) from
 * Open-Meteo, for the home scene's rain, cloud and wind and the desktop's menu
 * bar. Open-Meteo needs no API key; readings are cached so all visitors share
 * one upstream request every CACHE_MS.
 */
const LOCATION = { name: 'Railay, Krabi', latitude: 8.011, longitude: 98.837 };
const CACHE_MS = 10 * 60 * 1000;
// If Open-Meteo is down, keep serving the last good reading for this long
const STALE_MS = 3 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

const UPSTREAM = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: String(LOCATION.latitude),
  longitude: String(LOCATION.longitude),
  current: 'temperature_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  wind_speed_unit: 'ms',
  timezone: 'Asia/Bangkok',
})}`;

let cached = null; // { data, fetchedAt }
let inFlight = null;

const toNumber = (value) => (Number.isFinite(value) ? value : null);

const fetchCurrent = async () => {
  const response = await fetch(UPSTREAM, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
  const { current } = await response.json();
  if (!current || !Number.isFinite(current.weather_code)) throw new Error('Open-Meteo sent no current weather');
  // Only the fields the site uses, as plain numbers
  return {
    location: LOCATION.name,
    time: typeof current.time === 'string' ? current.time : null, // Bangkok local time
    temperature: toNumber(current.temperature_2m), // °C
    isDay: current.is_day === 1,
    precipitation: toNumber(current.precipitation), // mm in the last 15 minutes
    weatherCode: current.weather_code, // WMO code
    cloudCover: toNumber(current.cloud_cover), // %
    windSpeed: toNumber(current.wind_speed_10m), // m/s
    windDirection: toNumber(current.wind_direction_10m), // degrees, where it blows from
    windGusts: toNumber(current.wind_gusts_10m), // m/s
  };
};

/** GET /api/weather */
const getWeather = async (req, res) => {
  const now = Date.now();
  if (!cached || now - cached.fetchedAt > CACHE_MS) {
    try {
      // Requests arriving while one is on its way share it
      inFlight = inFlight || fetchCurrent().finally(() => { inFlight = null; });
      cached = { data: await inFlight, fetchedAt: Date.now() };
    } catch (error) {
      console.warn('Weather fetch failed:', error.message);
      if (!cached || now - cached.fetchedAt > STALE_MS) {
        return res.status(503).json({ error: 'Weather unavailable' });
      }
    }
  }
  res.set('Cache-Control', 'public, max-age=300');
  return res.json(cached.data);
};

module.exports = { getWeather };
