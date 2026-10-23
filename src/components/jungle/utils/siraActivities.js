/*
 * Things Sira does on the island, each as a list of steps that <Likeness />
 * runs in order:
 *   { walk: [x, z] }            walk (or wade, or swim) there, around obstacles
 *   { face: [x, z] }            turn on the spot to face a point
 *   { act, seconds, ... }       hold a pose (siraPose POSES) for a while, with
 *                               optional `look` target, `every`/`tick` effects,
 *                               `anchor` (hip position, for sitting) and `motion`
 *   { say, seconds, laptop }    speech bubble (with an "Open it" button for the laptop)
 *   { run }                     call a function
 *   { board } / { paddle: [[x, z], ...] } / { dock } / { unboard }   kayak trip
 */
import { CAMERA, ISLAND, LAPTOP_FOCUS, LAYOUT } from '../sceneConfig';
import { terrainHeight } from '../Island';
import { emit, emitBurst, fire, kayak, strikeFlint, world } from './play';
import { LOG_SEAT } from './siraPath';

const FIRE = [LAYOUT.campfire.position[0], LAYOUT.campfire.position[2]];
const CAM_DIR = [Math.cos(CAMERA.hero.azimuth), Math.sin(CAMERA.hero.azimuth)];
const SEA_DIR = [Math.SQRT1_2, Math.SQRT1_2];
const LAPTOP = [LAPTOP_FOCUS[0], LAPTOP_FOCUS[2]];
const SPARKS = [5, 2.2, 0.6];

/** Spots around camp (all clear of the camera's flight into the laptop). */
const SPOTS = {
  // Across the fire from the camera, so he faces the visitor while tending it
  fire: [FIRE[0] - CAM_DIR[0] * 0.85, FIRE[1] - CAM_DIR[1] * 0.85],
  // Beside the table, off the camera's path to the screen
  laptop: [1.1, -0.35],
  view: [2.0, 0.3],
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A poke at the fire: more fuel and sparks, or flint sparks that rekindle a cold fire. */
const pokeFire = () => {
  const at = [FIRE[0], 0.12, FIRE[1]];
  if (fire.fuel <= 0) {
    strikeFlint(at, true);
    return;
  }
  fire.fuel = Math.min(1, fire.fuel + 0.1);
  fire.push.x += (Math.random() - 0.5) * 0.06;
  fire.push.z += (Math.random() - 0.5) * 0.06;
  emitBurst({ position: [FIRE[0], 0.25, FIRE[1]], count: 8, color: SPARKS, speed: 0.7, up: 1.2, gravity: 2, life: 0.6, size: 0.006 });
};

const fireActivity = (relight) => [
  { walk: SPOTS.fire },
  { face: FIRE },
  { say: relight ? 'Brrr… let me relight it!' : fire.fuel < 0.4 ? 'Needs a poke 🔥' : pick(['Keeping it cozy 🔥', null]) },
  {
    act: 'crouch',
    seconds: relight ? 12 : rand(7, 10),
    look: [FIRE[0], 0.1, FIRE[1]],
    every: 1.4,
    tick: pokeFire,
    // Jab with the right hand on each poke
    motion: (t) => ({ upperarm_R: { swing: 0.35 * Math.max(0, Math.sin((t / 1.4) * Math.PI * 2)) } }),
    // Stop early once a relit fire has caught
    until: () => relight && fire.fuel > 0.3,
  },
];

const logActivity = () => [
  { walk: LOG_SEAT.approach },
  { face: FIRE },
  { say: pick(['Ahh, this is the life.', 'Time for a break.', null]) },
  {
    act: 'sit',
    seconds: rand(10, 16),
    anchor: [LOG_SEAT.seat[0], LOG_SEAT.height, LOG_SEAT.seat[1]],
    look: (t) => (Math.sin(t * 0.5) > 0.3 ? 'camera' : [FIRE[0], 0.2, FIRE[1]]),
  },
];

const laptopActivity = () => [
  { walk: SPOTS.laptop },
  { face: LAPTOP },
  { say: pick(['My work is on this laptop →', 'Come see what I build →', 'Projects are in here →']), seconds: 4.5, laptop: true },
  {
    act: 'type',
    seconds: rand(8, 11),
    look: LAPTOP_FOCUS,
    motion: (t) => ({ forearm_L: { swing: 0.1 * Math.sin(t * 17) }, forearm_R: { swing: 0.1 * Math.cos(t * 19) } }),
  },
];

const viewActivity = () => {
  const out = [SPOTS.view[0] + CAM_DIR[0] * 5, SPOTS.view[1] + CAM_DIR[1] * 5];
  return [
    { walk: SPOTS.view },
    { face: out },
    { act: 'stretch', seconds: 2.4, look: [out[0], 3, out[1]] },
    { say: pick(['What a view! 🌴', 'Ahh, island life.']) },
    { act: 'stand', seconds: 3, look: (t) => [out[0] + Math.sin(t * 0.9) * 4, 1.4, out[1]] },
  ];
};

const coconutActivity = (from) => {
  // One of the palms nearest to where he is
  const palms = [...world.palms].sort((a, b) => Math.hypot(a.x - from[0], a.z - from[1]) - Math.hypot(b.x - from[0], b.z - from[1]));
  const palm = pick(palms.slice(0, 4));
  if (!palm) return null;
  const dx = from[0] - palm.x;
  const dz = from[1] - palm.z;
  const d = Math.hypot(dx, dz) || 1;
  const spot = [palm.x + (dx / d) * 0.55, palm.z + (dz / d) * 0.55];
  let shaken = false;
  return [
    { say: 'Coconut time! 🥥' },
    { walk: spot },
    { face: [palm.x, palm.z] },
    {
      act: 'shake',
      seconds: 2.2,
      look: [palm.x, 4, palm.z],
      motion: (t) => ({ spine: { swing: 0.1 * Math.sin(t * 22) } }),
      tick: () => {
        if (shaken) return;
        shaken = true;
        emit('shakePalm', { index: palm.index });
      },
      every: 0.8,
    },
    { say: pick(['Got one! 🥥', 'Heads up!']) },
    { act: 'cheer', seconds: 1.4, look: 'camera' },
  ];
};

/** Sea surface below this terrain height (m) is deep enough to swim in. */
const SWIM_DEPTH = 1.15;

const swimActivity = () => {
  const a = Math.atan2(SEA_DIR[1], SEA_DIR[0]) + rand(-0.45, 0.45);
  const dir = [Math.cos(a), Math.sin(a)];
  let beach = null;
  let deep = null;
  for (let d = 4; d < 30 && !deep; d += 0.25) {
    const h = terrainHeight(dir[0] * d, dir[1] * d);
    if (!beach && h < ISLAND.waterLevel + 0.05) beach = [dir[0] * (d - 0.8), dir[1] * (d - 0.8)];
    if (h < ISLAND.waterLevel - SWIM_DEPTH) deep = [dir[0] * (d + 1.5), dir[1] * (d + 1.5)];
  }
  if (!beach || !deep) return null;
  const side = [-dir[1], dir[0]];
  const loop = [
    [deep[0] + side[0] * 2, deep[1] + side[1] * 2],
    [deep[0] + dir[0] * 2, deep[1] + dir[1] * 2],
    [deep[0] - side[0] * 2, deep[1] - side[1] * 2],
  ].filter(([x, z]) => terrainHeight(x, z) < ISLAND.waterLevel - SWIM_DEPTH);
  return [
    { say: pick(['Going for a swim! 🏊', 'Time for a dip!']) },
    { walk: beach },
    { walk: deep },
    { say: pick(["The water's great!", 'Come on in! 🌊']) },
    ...loop.map((p) => ({ walk: p })),
    { walk: beach },
  ];
};

const kayakActivity = () => {
  const r = kayak.rest;
  if (!r) return null;
  const bow = [Math.sin(r.heading), Math.cos(r.heading)];
  // Board from the side facing camp
  let side = [bow[1], -bow[0]];
  if (side[0] * -r.x + side[1] * -r.z < 0) side = [-side[0], -side[1]];
  const at = (sea, along) => [r.x + SEA_DIR[0] * sea + bow[0] * along, r.z + SEA_DIR[1] * sea + bow[1] * along];
  return [
    { say: 'Kayak time! 🛶' },
    { walk: [r.x + side[0] * 0.8, r.z + side[1] * 0.8], withKayak: false },
    { face: [r.x, r.z] },
    { board: true },
    { paddle: [at(4, 0.5), at(7, 3.5), at(6, 7), at(3, 6), at(1.2, 1.5), at(0, 0)] },
    { dock: true },
    { unboard: [r.x + side[0] * 0.8, r.z + side[1] * 0.8] },
  ];
};

/** Activities with how often he picks them; `away` ones take him off camp. */
export const ACTIVITIES = {
  fire: { build: () => fireActivity(false), weight: () => (fire.fuel < 0.35 ? 6 : 1) },
  log: { build: logActivity, weight: () => 1 },
  laptop: { build: laptopActivity, weight: () => 1.4 },
  view: { build: viewActivity, weight: () => 0.6 },
  coconut: { build: coconutActivity, weight: () => (world.palms.length ? 1 : 0), away: true },
  swim: { build: swimActivity, weight: () => 0.8, away: true },
  kayak: { build: kayakActivity, weight: () => (kayak.rest ? 0.7 : 0), away: true },
};

/** Pick the next activity: never the same twice, and back to camp after an outing. */
export const chooseActivity = (last) => {
  const options = Object.entries(ACTIVITIES)
    .filter(([id]) => id !== last)
    .map(([id, a]) => [id, a.weight() * (a.away && ACTIVITIES[last]?.away ? 0.15 : 1)]);
  let r = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of options) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'laptop';
};

export const relightActivity = () => fireActivity(true);
