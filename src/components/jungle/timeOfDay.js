import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

/**
 * Time-of-day system: the island keeps Bangkok time, where Sira lives, so a
 * visitor anywhere in the world sees the camp as it is for him right now
 * (asleep in the tent during the Thai night, even if it's lunchtime for them).
 *
 * The hour is mapped to a sun elevation `e` (≈ sin of the sun's altitude,
 * -0.75 at midnight … 0.75 at noon, 0 around 6:15 and 18:30). Every look
 * parameter is keyframed against `e` and linearly interpolated, so dawn and
 * dusk blend smoothly.
 *
 * For previewing, `?time=HH:MM` in the URL overrides the clock.
 */

// Bangkok is UTC+7 all year (Thailand has no daylight saving time)
const BANGKOK_UTC_OFFSET = 7;

// The sun sweeps across the front-left of the default view, so the block's
// visible faces are lit and shadows fall across the island
const SUNRISE_AZIMUTH = THREE.MathUtils.degToRad(40);
const SUNSET_AZIMUTH = THREE.MathUtils.degToRad(165);
const MOON_AZIMUTH = THREE.MathUtils.degToRad(110);
const SOLAR_NOON = 12.375;
const SUNRISE_HOUR = 6.25;
const SUNSET_HOUR = 18.5;

/*
 * Look keyframes, ordered by sun elevation. `key*` describes the main
 * shadow-casting light: the moon at night, the sun otherwise.
 *
 * Lit like a pre-rendered diorama: a strong, warm sun against a cooler,
 * softer sky light, so sunlit faces glow and shade reads blue rather than
 * grey. The baked ground occlusion (utils/groundOcclusion.js) darkens the sky
 * light where things crowd together. The HDRI (`env`) stays faint: it is a
 * green rainforest photo, so it would tint every shadow green and override
 * the time-of-day colors; it mostly adds soft reflections.
 */
const KEYFRAMES = [
  {
    e: -0.35, // night
    backdropTop: '#0c1230', backdropBottom: '#232a4f', stars: 1, moon: 1,
    keyColor: '#8ea4dc', keyIntensity: 0.8,
    hemiSky: '#45568c', hemiGround: '#0e120c', hemiIntensity: 0.8,
    fill: 0.2, env: 0.05, fireflies: 1,
  },
  {
    e: -0.07, // blue hour
    backdropTop: '#22284d', backdropBottom: '#6e5470', stars: 0.35, moon: 0.4,
    keyColor: '#ff9a5c', keyIntensity: 0.35,
    hemiSky: '#8c9fd6', hemiGround: '#1c2414', hemiIntensity: 0.8,
    fill: 0.16, env: 0.06, fireflies: 0.8,
  },
  {
    e: 0.05, // golden hour
    backdropTop: '#5f8fd8', backdropBottom: '#ffd3a6', stars: 0, moon: 0,
    keyColor: '#ffbe84', keyIntensity: 3.0,
    // Sunset glow: even the shade is warm
    hemiSky: '#d0c1bc', hemiGround: '#6a5a40', hemiIntensity: 1.3,
    fill: 0.1, env: 0.07, fireflies: 0.1,
  },
  {
    e: 0.25, // morning / afternoon
    backdropTop: '#4b9ce6', backdropBottom: '#d3ebfa', stars: 0, moon: 0,
    keyColor: '#ffe9cc', keyIntensity: 2.5,
    hemiSky: '#cad9f3', hemiGround: '#827f54', hemiIntensity: 1.3,
    fill: 0.1, env: 0.07, fireflies: 0,
  },
  {
    e: 0.6, // midday
    backdropTop: '#4799e6', backdropBottom: '#d0eafa', stars: 0, moon: 0,
    keyColor: '#fff0dc', keyIntensity: 2.6,
    hemiSky: '#cddcf5', hemiGround: '#868458', hemiIntensity: 1.35,
    fill: 0.1, env: 0.07, fireflies: 0,
  },
];

/** Brightest sky light of the day (midday), for things lit relative to it. */
export const PEAK_HEMI_INTENSITY = Math.max(...KEYFRAMES.map((k) => k.hemiIntensity));

const COLOR_KEYS = ['backdropTop', 'backdropBottom', 'keyColor', 'hemiSky', 'hemiGround'];
const NUMBER_KEYS = ['stars', 'moon', 'keyIntensity', 'hemiIntensity', 'fill', 'env', 'fireflies'];

const directionFrom = (azimuth, elevation) => {
  const altitude = Math.asin(THREE.MathUtils.clamp(elevation, -1, 1));
  return new THREE.Vector3(Math.cos(altitude) * Math.cos(azimuth), Math.sin(altitude), Math.cos(altitude) * Math.sin(azimuth)).normalize();
};

/** Sun elevation (≈ sin(altitude)) for a decimal local hour. */
export const sunElevationAt = (hour) => 0.75 * Math.cos((2 * Math.PI * (hour - SOLAR_NOON)) / 24);

/** Full look description for a decimal local hour (0–24). */
export const environmentAt = (hour) => {
  const e = sunElevationAt(hour);

  // Interpolate keyframes
  let i = KEYFRAMES.findIndex((k) => k.e > e);
  if (i === -1) i = KEYFRAMES.length - 1;
  const a = KEYFRAMES[Math.max(0, i - 1)];
  const b = KEYFRAMES[i];
  const t = a === b ? 0 : THREE.MathUtils.clamp((e - a.e) / (b.e - a.e), 0, 1);
  const env = { elevation: e, hour };
  COLOR_KEYS.forEach((k) => {
    env[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  });
  NUMBER_KEYS.forEach((k) => {
    env[k] = THREE.MathUtils.lerp(a[k], b[k], t);
  });

  // Sun sweeps from sunrise to sunset azimuth during the day
  const dayProgress = THREE.MathUtils.clamp((hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR), 0, 1);
  env.sunDirection = directionFrom(THREE.MathUtils.lerp(SUNRISE_AZIMUTH, SUNSET_AZIMUTH, dayProgress), e);

  // Moon follows a similar, lower arc through the night
  const nightLength = 24 - (SUNSET_HOUR - SUNRISE_HOUR);
  const nightProgress = THREE.MathUtils.clamp((((hour - SUNSET_HOUR) % 24) + 24) % 24 / nightLength, 0, 1);
  env.moonDirection = directionFrom(
    // Moon crosses behind the karsts as seen from the default view
    THREE.MathUtils.lerp(MOON_AZIMUTH + 0.6, MOON_AZIMUTH - 0.6, nightProgress),
    Math.max(-e, 0) * 0.12 + 0.2
  );

  // Main light: the sun while it's near/above the horizon, otherwise the moon.
  // The swap happens at deep twilight when the key light is dim anyway. A low
  // sun lights the scene from at least ~13° up, so the golden hour still bathes
  // the ground in warm light instead of grazing it.
  env.isNight = e < -0.05;
  env.keyDirection = env.isNight ? env.moonDirection : env.sunDirection.clone().setY(Math.max(env.sunDirection.y, 0.22)).normalize();
  return env;
};

const parseTimeOverride = () => {
  if (typeof window === 'undefined') return null;
  const match = new URLSearchParams(window.location.search).get('time')?.match(/^(\d{1,2}):?(\d{2})?$/);
  if (!match) return null;
  return THREE.MathUtils.clamp(Number(match[1]) + Number(match[2] || 0) / 60, 0, 24);
};

/** The current hour (0–24) in Bangkok, whatever the visitor's own time zone. */
const currentHour = () => {
  const now = new Date();
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  return (utc + BANGKOK_UTC_OFFSET) % 24;
};

/** The hour the scene opens at: the `?time=` override, or Bangkok time. */
export const initialHour = () => parseTimeOverride() ?? currentHour();

/** Human-readable name of the phase for a decimal hour (used by the debug panel). */
export const phaseName = (hour) => {
  const e = sunElevationAt(hour);
  if (e < -0.2) return 'Night';
  if (e < -0.03) return 'Blue hour';
  if (e < 0.12) return hour < 12 ? 'Sunrise' : 'Sunset';
  if (e < 0.4) return hour < 12 ? 'Morning' : 'Afternoon';
  return 'Midday';
};

export const formatHour = (hour) => {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * React hook: the environment for the current Bangkok time, refreshed every
 * minute. `setOverride(hour)` pins a specific time (debug panel / `?time=`),
 * `setOverride(null)` goes back to following Bangkok time.
 */
export const useTimeOfDay = () => {
  const [override, setOverride] = useState(parseTimeOverride);
  const [clockHour, setClockHour] = useState(currentHour);

  useEffect(() => {
    const timer = setInterval(() => setClockHour(currentHour()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = override ?? clockHour;
  const env = useMemo(() => environmentAt(hour), [hour]);
  return { env, hour, isOverridden: override !== null, setOverride };
};
