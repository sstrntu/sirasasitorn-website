import * as THREE from 'three';
import { ISLAND } from '../sceneConfig';

/**
 * Interactive water: a height-field wave simulation over the whole block,
 * in the spirit of a "jelly" sea. Ripples spread, slow down in the shallows,
 * and bounce off the shore and the block's glass-like sides.
 *
 * Anything can disturb it (pointer stirring, objects splashing in, the island
 * being spun/tipped). Water shaders read the heights from `waveUniforms`
 * (a small half-float texture); JS reads them with `waveHeightAt`.
 */

const N = 168; // grid nodes per side
const SIZE = ISLAND.max - ISLAND.min;
const CELL = SIZE / (N - 1);
const SUBSTEP = 1 / 120;
const GRAVITY = 9.8;
const MAX_HEIGHT = 0.7;

const current = new Float32Array(N * N);
const previous = new Float32Array(N * N);
const next = new Float32Array(N * N);
const isWater = new Uint8Array(N * N);
// Per-node wave speed term (c·dt/dx)², shallower water is slower
const courant = new Float32Array(N * N);
const halfData = new Uint16Array(N * N);

const settings = {
  // Fraction of wave velocity kept per substep: lower = calmer, faster settling
  damping: 0.996,
};

export const waveTexture = new THREE.DataTexture(halfData, N, N, THREE.RedFormat, THREE.HalfFloatType);
waveTexture.magFilter = THREE.LinearFilter;
waveTexture.minFilter = THREE.LinearFilter;
waveTexture.needsUpdate = true;

export const waveUniforms = {
  uWaves: { value: waveTexture },
  // xy: block min corner, z: size, w: grid nodes
  uWaveRect: { value: new THREE.Vector4(ISLAND.min, ISLAND.min, SIZE, N) },
};

/** GLSL helpers matching the simulation grid; needs `uWaves` and `uWaveRect` uniforms. */
export const WAVES_GLSL = /* glsl */ `
  uniform sampler2D uWaves;
  uniform vec4 uWaveRect;
  vec2 waveUv(vec2 xz) {
    vec2 g = (xz - uWaveRect.xy) / uWaveRect.z * (uWaveRect.w - 1.0);
    return (g + 0.5) / uWaveRect.w;
  }
  float waveHeight(vec2 xz) { return texture2D(uWaves, waveUv(xz)).r; }
  vec2 waveSlope(vec2 xz) {
    float e = uWaveRect.z / (uWaveRect.w - 1.0);
    return vec2(waveHeight(xz + vec2(e, 0.0)) - waveHeight(xz - vec2(e, 0.0)),
                waveHeight(xz + vec2(0.0, e)) - waveHeight(xz - vec2(0.0, e))) / (2.0 * e);
  }
`;

const index = (i, j) => j * N + i;
const nodeX = (i) => ISLAND.min + i * CELL;

/** Build the water mask and wave speeds from the terrain (call once). */
export const initWaves = (terrainHeight) => {
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const depth = ISLAND.waterLevel - terrainHeight(nodeX(i), nodeX(j));
      const k = index(i, j);
      isWater[k] = depth > 0.02 ? 1 : 0;
      const c2 = GRAVITY * THREE.MathUtils.clamp(depth, 0.08, 1.2);
      courant[k] = (c2 * SUBSTEP * SUBSTEP) / (CELL * CELL);
    }
  }
};

/** Node coordinates for a world point, or null outside the grid. */
const toGrid = (x, z) => {
  const gx = (x - ISLAND.min) / CELL;
  const gz = (z - ISLAND.min) / CELL;
  if (gx < 0 || gz < 0 || gx > N - 1 || gz > N - 1) return null;
  return [gx, gz];
};

/** True if (x, z) is over the sea (or stream/pool connected to it). */
export const isOverWater = (x, z) => {
  const g = toGrid(x, z);
  return !!g && isWater[index(Math.round(g[0]), Math.round(g[1]))] === 1;
};

/** Current wave height (m, relative to rest) at a world point. */
export const waveHeightAt = (x, z) => {
  const g = toGrid(x, z);
  if (!g) return 0;
  const i = Math.min(Math.floor(g[0]), N - 2);
  const j = Math.min(Math.floor(g[1]), N - 2);
  const fx = g[0] - i;
  const fz = g[1] - j;
  const a = current[index(i, j)];
  const b = current[index(i + 1, j)];
  const c = current[index(i, j + 1)];
  const d = current[index(i + 1, j + 1)];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
};

/**
 * Push the surface at (x, z): a smooth bump of `amount` meters over `radius`.
 * Positive raises (a splash rebounding), negative dents (a stone dropping in).
 */
export const disturbWaves = (x, z, radius, amount) => {
  const g = toGrid(x, z);
  if (!g) return;
  const r = radius / CELL;
  const i0 = Math.max(1, Math.floor(g[0] - r * 2));
  const i1 = Math.min(N - 2, Math.ceil(g[0] + r * 2));
  const j0 = Math.max(1, Math.floor(g[1] - r * 2));
  const j1 = Math.min(N - 2, Math.ceil(g[1] + r * 2));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = index(i, j);
      if (!isWater[k]) continue;
      const d2 = ((i - g[0]) ** 2 + (j - g[1]) ** 2) / (r * r);
      current[k] += amount * Math.exp(-d2 * 2);
    }
  }
};

/**
 * Tip the water: give every node a vertical kick that varies linearly across
 * the block (direction `ax`, `az`), like water lagging when its tray is tilted.
 * The walls then turn it into sloshing waves.
 */
export const tipWaves = (ax, az) => {
  const center = (ISLAND.min + ISLAND.max) / 2;
  for (let j = 0; j < N; j++) {
    const rz = nodeX(j) - center;
    for (let i = 0; i < N; i++) {
      const k = index(i, j);
      if (!isWater[k]) continue;
      // Kick the velocity (current - previous) by lowering `previous`
      previous[k] -= (ax * (nodeX(i) - center) + az * rz) * 0.0025;
    }
  }
};

export const setWaveDamping = (damping) => {
  settings.damping = damping;
};

let accumulator = 0;

/** Advance the simulation by `delta` seconds and upload the heights. */
export const stepWaves = (delta) => {
  accumulator = Math.min(accumulator + delta, SUBSTEP * 4);
  if (accumulator < SUBSTEP) return;
  while (accumulator >= SUBSTEP) {
    accumulator -= SUBSTEP;
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        const k = index(i, j);
        if (!isWater[k]) {
          next[k] = 0;
          continue;
        }
        const h = current[k];
        // Reflective walls: dry neighbours (shore, block sides) mirror this node
        const l = isWater[k - 1] ? current[k - 1] : h;
        const r = isWater[k + 1] ? current[k + 1] : h;
        const u = isWater[k - N] ? current[k - N] : h;
        const d = isWater[k + N] ? current[k + N] : h;
        const v = (h - previous[k]) * settings.damping + courant[k] * (l + r + u + d - 4 * h);
        next[k] = THREE.MathUtils.clamp(h + v, -MAX_HEIGHT, MAX_HEIGHT);
      }
    }
    // Edge rows copy their inner neighbour so the block's sides are walls too
    for (let n = 0; n < N; n++) {
      next[index(0, n)] = next[index(1, n)];
      next[index(N - 1, n)] = next[index(N - 2, n)];
      next[index(n, 0)] = next[index(n, 1)];
      next[index(n, N - 1)] = next[index(n, N - 2)];
    }
    previous.set(current);
    current.set(next);
  }
  for (let k = 0; k < N * N; k++) halfData[k] = THREE.DataUtils.toHalfFloat(current[k]);
  waveTexture.needsUpdate = true;
};
