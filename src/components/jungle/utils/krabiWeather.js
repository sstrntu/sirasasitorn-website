import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { watchWeather } from '../../../services/weather';
import { windWeather } from './wind';

/*
 * The island's weather is Krabi's, live (services/weather.js; `?weather=rain`
 * previews one). A change fades in over EASE_SECONDS. `weatherNow` is read
 * every frame (rain, the campfire, Sira heading for the tent); the hook gives
 * React the same values for the time-of-day look (`withWeather`), a few times
 * a second while a change fades in.
 */

const EASE_SECONDS = 20;
const EASE_STEP_MS = 250;
/** Rain this heavy (0–1, showers and up, not drizzle) sends Sira into the tent. */
const SHELTER_RAIN = 0.4;

/** rain 0–1, gloom (how grey the sky is) 0–1, wind m/s, fog 0–1 */
export const weatherNow = { rain: 0, gloom: 0, wind: 2, fog: 0, shelter: false, kind: 'clear' };

const CALM = { rain: 0, gloom: 0, wind: 2, fog: 0 };
const KEYS = Object.keys(CALM);

/** Overcast skies and rain grey the sky; patchy cloud barely does. */
const gloomOf = (weather) =>
  Math.max(
    THREE.MathUtils.clamp((weather.cloud - 0.45) / 0.5, 0, 1) * 0.8,
    weather.rain > 0 ? 0.8 + 0.2 * weather.rain : 0,
    weather.fog ? 0.85 : 0
  );

/** Foliage sways harder in a strong wind (calm days keep the usual sway). */
const windScaleFor = (wind) => 1 + THREE.MathUtils.clamp((wind - 4) / 12, 0, 0.5);

/** Live weather for the island, eased: { rain, gloom, wind, fog }. */
export const useKrabiWeather = () => {
  const [state, setState] = useState(CALM);

  useEffect(() => {
    let shown = { ...CALM };
    let first = true;
    let timer = 0;
    const apply = (values) => {
      shown = values;
      Object.assign(weatherNow, values);
      windWeather.scale = windScaleFor(values.wind);
      setState(values);
    };
    const stop = watchWeather((weather) => {
      const target = { rain: weather.rain, gloom: gloomOf(weather), wind: weather.wind, fog: weather.fog ? 1 : 0 };
      weatherNow.kind = weather.kind;
      weatherNow.shelter = weather.rain >= SHELTER_RAIN;
      clearInterval(timer);
      // The first reading arrives while the scene loads: show it as it is
      if (first) {
        first = false;
        apply(target);
        return;
      }
      const from = shown;
      const start = performance.now();
      timer = setInterval(() => {
        const k = Math.min(1, (performance.now() - start) / (EASE_SECONDS * 1000));
        const e = k * k * (3 - 2 * k);
        apply(Object.fromEntries(KEYS.map((key) => [key, THREE.MathUtils.lerp(from[key], target[key], e)])));
        if (k >= 1) clearInterval(timer);
      }, EASE_STEP_MS);
    });
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);

  return state;
};

const OVERCAST = {
  dayTop: new THREE.Color('#8794a0'),
  dayBottom: new THREE.Color('#c2c9cf'),
  nightTop: new THREE.Color('#0f131a'),
  nightBottom: new THREE.Color('#242a33'),
  sky: new THREE.Color('#b7c0c9'),
  nightSky: new THREE.Color('#3a4350'),
  light: new THREE.Color('#f1f1ee'),
};

/**
 * The time-of-day look (timeOfDay.js environmentAt) under the weather: grey
 * skies, the sun dimmed behind cloud (so shadows soften away), no stars or
 * fireflies in the rain. Adds `rain`, `gloom` and `wind` for the scene.
 */
export const withWeather = (env, weather) => {
  const out = { ...env, rain: weather.rain, gloom: weather.gloom, wind: weather.wind };
  const g = weather.gloom;
  if (g < 0.001 && weather.rain < 0.001) return out;
  const night = THREE.MathUtils.smoothstep(-env.elevation, -0.02, 0.12);
  const top = OVERCAST.dayTop.clone().lerp(OVERCAST.nightTop, night);
  const bottom = OVERCAST.dayBottom.clone().lerp(OVERCAST.nightBottom, night);
  out.backdropTop = env.backdropTop.clone().lerp(top, g * 0.85);
  out.backdropBottom = env.backdropBottom.clone().lerp(bottom, g * 0.85);
  out.hemiSky = env.hemiSky.clone().lerp(OVERCAST.sky.clone().lerp(OVERCAST.nightSky, night), g * 0.6);
  out.keyColor = env.keyColor.clone().lerp(OVERCAST.light, g * 0.4);
  out.keyIntensity = env.keyIntensity * (1 - 0.78 * g);
  out.hemiIntensity = env.hemiIntensity * (1 + 0.08 * g);
  out.stars = env.stars * (1 - g);
  out.moon = env.moon * (1 - 0.9 * g);
  out.fireflies = env.fireflies * (1 - weather.rain);
  return out;
};
