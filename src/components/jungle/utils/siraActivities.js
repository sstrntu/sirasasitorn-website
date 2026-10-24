/*
 * Things Sira does on the island, each as a list of steps that <Likeness />
 * runs in order:
 *   { walk: [x, z] }            walk (or wade, or swim) there, around obstacles
 *   { face: [x, z] }            turn on the spot to face a point
 *   { act, seconds, ... }       hold a pose (siraPose POSES) for a while, with
 *                               optional `look` target, `every`/`tick(t)` effects,
 *                               `anchor` (where the hips rest: kneeling, a seat,
 *                               the bed) and how fast he settles there
 *                               (`anchorRate`), a `pose` layer on top, `motion`,
 *                               `until`, `sleepy` (eyes shut: Zzz, no looking
 *                               around), `fill` / `pour` (the bucket)
 *   { say, seconds, laptop }    speech bubble (with an "Open it" button for the laptop)
 *   { carry }                   pick up 'wood' or 'bucket' (null puts it down)
 *   { run }                     call a function
 *   { board } / { paddle: [[x, z], ...] } / { dock } / { unboard }   kayak trip
 *
 * What he picks follows Bangkok time (siraDay): bed at night, a nap
 * after lunch, the fire lit for breakfast and the evening, no swimming after dark.
 */
import { CAMERA, ISLAND, LAPTOP, LAPTOP_FOCUS, LAYOUT, TABLE } from '../sceneConfig';
import { terrainHeight } from '../Island';
import { BED, tentPoint } from '../Tent';
import { bucket, emit, emitBurst, fire, kayak, strikeFlint, world } from './play';
import { LOG_SEAT } from './siraPath';
import { KNEEL_HIP, LIE_HIP, SIT_HIP } from './siraPose';
import { day, isDaylight, isNapTime, isSleepTime } from './siraDay';

const FIRE = [LAYOUT.campfire.position[0], LAYOUT.campfire.position[2]];
const CAM_DIR = [Math.cos(CAMERA.hero.azimuth), Math.sin(CAMERA.hero.azimuth)];
const SEA_DIR = [Math.SQRT1_2, Math.SQRT1_2];
const SPARKS = [5, 2.2, 0.6];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** The point `d` m from `from` toward `to` ([x, z] each). */
const toward = (from, to, d) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz) || 1;
  return [from[0] + (dx / len) * d, from[1] + (dz / len) * d];
};

/** Hip position for kneeling at [x, z]. */
const kneelAt = ([x, z]) => [x, terrainHeight(x, z) + KNEEL_HIP, z];

/** Points on the laptop's keyboard (world), for his hands. */
const KEYS = (() => {
  const [tx, , tz] = LAYOUT.table.position;
  const a = LAYOUT.table.rotationY;
  const b = a + LAPTOP.rotationY;
  const [ox, , oz] = LAPTOP.offset;
  const cx = tx + ox * Math.cos(a) + oz * Math.sin(a);
  const cz = tz - ox * Math.sin(a) + oz * Math.cos(a);
  // In the laptop's frame: x across the keyboard, z toward its front edge
  const at = (x, z) => [cx + x * Math.cos(b) + z * Math.sin(b), TABLE.height + LAPTOP.baseThickness + 0.015, cz - x * Math.sin(b) + z * Math.cos(b)];
  const ground = (x, z) => [cx + x * Math.cos(b) + z * Math.sin(b), cz - x * Math.sin(b) + z * Math.cos(b)];
  return {
    center: at(-0.03, -0.02),
    left: at(-0.08, -0.03),
    right: at(0.02, -0.01),
    // Kneeling in front of it, a little to its left: facing the screen, yet clear of the
    // hero shot of it (the camera looks on from its front right)
    kneel: ground(-0.27, 0.47),
    approach: ground(-0.34, 0.62),
    // Well off to the left, out of the camera's way as it flies into the screen
    aside: ground(-0.8, 0.1),
  };
})();

/** Where he steps when the camera flies into the laptop while he's working at it. */
export const LAPTOP_ASIDE = KEYS.aside;

const WOOD = [LAYOUT.woodpile.position[0], LAYOUT.woodpile.position[2]];
const BUCKET = [LAYOUT.bucket.position[0], LAYOUT.bucket.position[2]];

/** Spots around camp (all clear of the camera's flight into the laptop). */
const SPOTS = {
  // Across the fire from the camera, so he faces the visitor while tending it
  fire: [FIRE[0] - CAM_DIR[0] * 0.85, FIRE[1] - CAM_DIR[1] * 0.85],
  // Closer in, to pour the bucket over it
  douse: [FIRE[0] - CAM_DIR[0] * 0.62, FIRE[1] - CAM_DIR[1] * 0.62],
  // In front of the laptop, to its left (KEYS); he steps in to kneel
  laptop: KEYS.approach,
  view: [2.0, 0.3],
  // On the camp side of the woodpile, and behind the bucket (facing the camera as he picks it up)
  wood: toward(WOOD, [0, 0], 0.62),
  bucket: toward(BUCKET, [-0.6, 0.1], 0.45),
};

/** In the tent: the doorway, outside it, and lying on the bed with his head by the door. */
const TENT = {
  outside: tentPoint(BED.door + 0.5, BED.z),
  inside: tentPoint(BED.door - 1.5, BED.z),
  // His hips lie about 1 m from where his head rests
  bed: (() => {
    const [x, z] = tentPoint(BED.head - 1.0, BED.z);
    return [x, BED.surface + LIE_HIP, z];
  })(),
};

/** The camp chair's sling seat: its lowest point, a spot in front, and the way it faces. */
const CHAIR = (() => {
  const [cx, , cz] = LAYOUT.chair.position;
  const a = LAYOUT.chair.rotationY;
  const facing = [Math.sin(a), Math.cos(a)];
  return {
    seat: [cx - facing[0] * 0.05, 0.2 + SIT_HIP, cz - facing[1] * 0.05],
    front: [cx + facing[0] * 0.6, cz + facing[1] * 0.6],
    ahead: [cx + facing[0] * 3, cz + facing[1] * 3],
  };
})();

/** Where to fill the bucket: dry sand at the water's edge toward the beach, and a point just out in the water. */
const shore = () => {
  for (let d = 3; d < 20; d += 0.2) {
    if (terrainHeight(SEA_DIR[0] * d, SEA_DIR[1] * d) < ISLAND.waterLevel - 0.06) {
      return { stand: [SEA_DIR[0] * (d - 0.3), SEA_DIR[1] * (d - 0.3)], water: [SEA_DIR[0] * (d + 0.6), SEA_DIR[1] * (d + 0.6)] };
    }
  }
  return null;
};

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

/** Warming his hands at the fire: they open and close a little, out of step. */
const warmingHands = (t) => ({ arm_L: { flex: 0.06 * Math.sin(t * 1.6) }, arm_R: { flex: 0.06 * Math.sin(t * 1.6 + 1.5) } });

/** Blowing on the new flames: they lean away from him, grow, and spit a few sparks. */
const blowOnFire = () => {
  const [dx, dz] = toward([0, 0], [FIRE[0] - SPOTS.fire[0], FIRE[1] - SPOTS.fire[1]], 1);
  fire.push.x += dx * 0.05;
  fire.push.z += dz * 0.05;
  if (fire.fuel > 0) fire.fuel = Math.min(1, fire.fuel + 0.04);
  emitBurst({ position: [FIRE[0], 0.15, FIRE[1]], count: 5, color: SPARKS, speed: 0.4, up: 0.9, gravity: 1.5, life: 0.6, size: 0.005 });
};

const fireActivity = () => [
  { walk: SPOTS.fire },
  { face: FIRE },
  { say: fire.fuel < 0.4 ? 'Needs a poke 🔥' : pick(['Keeping it cozy 🔥', null]) },
  {
    act: 'crouch',
    seconds: rand(7, 10),
    anchor: kneelAt(SPOTS.fire),
    look: [FIRE[0], 0.1, FIRE[1]],
    every: 1.4,
    tick: pokeFire,
    // Jab with the right hand on each poke
    motion: (t) => {
      const jab = Math.max(0, Math.sin((t / 1.4) * Math.PI * 2));
      return { arm_R: { dir: [0.35 * jab, -0.1 * jab, 0], flex: -0.2 * jab } };
    },
  },
];

/** Strikes come in bursts, with a breath in between. */
const STRIKE_BURST = 1.1;
const STRIKE_CYCLE = 1.7;

/** Fetch an armful of firewood, lay it in the ring, and strike the flint until it catches. */
const makeFireActivity = (line) => {
  const [sx, sz] = toward(FIRE, SPOTS.fire, 0.16);
  const sparksAt = [sx, 0.1, sz];
  const striking = (t) => t % STRIKE_CYCLE < STRIKE_BURST;
  const kneel = kneelAt(SPOTS.fire);
  const lookFire = [FIRE[0], 0.08, FIRE[1]];
  return [
    { say: line },
    { walk: SPOTS.wood },
    { face: WOOD },
    { act: 'pickup', seconds: 1.3, anchor: kneelAt(SPOTS.wood), look: [WOOD[0], 0.1, WOOD[1]] },
    { carry: 'wood' },
    { walk: SPOTS.fire },
    { face: FIRE },
    { act: 'pickup', seconds: 1.2, anchor: kneel, look: lookFire },
    { carry: null },
    {
      run: () => {
        fire.fresh = 1;
      },
    },
    {
      act: 'strike',
      seconds: 12,
      anchor: kneel,
      look: lookFire,
      every: 0.28,
      tick: (t) => striking(t) && strikeFlint(sparksAt, true),
      // The right hand scrapes down along the left
      motion: (t) => {
        const k = striking(t) ? Math.max(0, Math.sin(t * 22)) : 0;
        return { arm_R: { dir: [0.12 * k, -0.2 * k, 0], flex: -0.15 * k } };
      },
      until: () => fire.fuel > 0,
    },
    { act: 'blow', seconds: 3, anchor: kneel, look: lookFire, every: 0.75, tick: blowOnFire },
    { say: pick(['There we go! 🔥', 'Fire’s going! 🔥']) },
  ];
};

/** What he says as he sets off to build the fire. */
const fireLine = (hour) => {
  if (hour >= 5 && hour < 11) return pick(['Morning fire, then coffee ☕', 'Let’s get a fire going 🔥']);
  if (hour >= 17) return pick(['Fire for the evening 🔥', 'Getting the fire going 🔥']);
  return pick(['The fire’s out! Let me relight it 🔥', 'Brrr… let me relight it!']);
};

/** Fetch the bucket, fill it at the water's edge, pour it over the fire, and put it back. */
const douseActivity = () => {
  const sea = shore();
  if (!sea) return [];
  return [
    { say: pick(['Fire out before bed 💧', 'Time to put the fire out 💧']) },
    { walk: SPOTS.bucket },
    { face: BUCKET },
    { act: 'pickup', seconds: 0.9, anchor: kneelAt(SPOTS.bucket), look: [BUCKET[0], 0.1, BUCKET[1]] },
    { carry: 'bucket' },
    { walk: sea.stand },
    { face: sea.water },
    { act: 'scoop', seconds: 2, anchor: kneelAt(sea.stand), look: [sea.water[0], 0, sea.water[1]], fill: true },
    { walk: SPOTS.douse },
    { face: FIRE },
    { act: 'pour', seconds: 4, look: [FIRE[0], 0.1, FIRE[1]], pour: true, until: () => bucket.water <= 0 },
    { walk: SPOTS.bucket },
    { face: BUCKET },
    { act: 'pickup', seconds: 0.8, anchor: kneelAt(SPOTS.bucket), look: [BUCKET[0], 0.1, BUCKET[1]] },
    { carry: null },
  ];
};

/** Asleep in the tent until morning. */
const sleepStep = () => ({ act: 'sleep', seconds: Infinity, anchor: TENT.bed, anchorRate: 1.6, sleepy: true, until: () => !isSleepTime(day.hour) });

/** Crawl out of the tent and stretch. */
const wakeSteps = (line) => [
  { act: 'kneel', seconds: 1.5, anchor: kneelAt(TENT.outside), anchorRate: 2.2 },
  { face: FIRE },
  { act: 'stretch', seconds: 2.4, look: 'camera' },
  { say: line },
];
const morning = () => wakeSteps(pick(['Good morning! ☀️', 'Morning! What a night 🌅']));

/** Put the fire out, then go to bed (and get up again once it's morning). */
const bedtimeActivity = () => [
  ...(fire.fuel > 0 ? douseActivity() : []),
  { say: pick(['Good night! 🌙', 'Time for bed 😴']) },
  { walk: TENT.outside },
  { face: TENT.inside },
  { act: 'kneel', seconds: 1.1, anchor: kneelAt(TENT.outside) },
  sleepStep(),
  ...morning(),
];

/** Already asleep when the visitor arrives at night (fire out, in bed). */
export const sleepingSteps = () => [sleepStep(), ...morning()];

/**
 * Woken up in the night by the visitor: he gets up, lights the fire and sits
 * up with them by it for a while (then it's bedtime again).
 */
const wokenActivity = () => [
  ...wakeSteps(pick(['Can’t sleep? Me neither 🌙', 'What a starry night ✨'])),
  ...(fire.fuel <= 0 ? makeFireActivity(pick(['Let’s get the fire going 🔥', 'A fire, then 🔥'])) : []),
  { walk: LOG_SEAT.approach },
  { face: FIRE },
  { say: pick(['Since we’re up… my work is on the laptop →', 'While you’re here, my projects are on the laptop →']), seconds: 4.5, laptop: true },
  {
    act: 'sit',
    seconds: rand(28, 38),
    anchor: [LOG_SEAT.seat[0], LOG_SEAT.height + SIT_HIP, LOG_SEAT.seat[1]],
    look: (t) => (Math.sin(t * 0.4) > 0 ? 'camera' : [FIRE[0], 0.2, FIRE[1]]),
    motion: warmingHands,
  },
];

/** Where he lies in bed: hips position and the way he faces (into the tent; his head is by the door). */
export const BED_POSE = { anchor: TENT.bed, facing: toward([0, 0], [TENT.inside[0] - TENT.outside[0], TENT.inside[1] - TENT.outside[1]], 1) };

/** Naps are at most this often (ms). */
const NAP_GAP = 10 * 60 * 1000;
const naps = { last: -Infinity };

const napActivity = () => {
  naps.last = performance.now();
  return [
    { say: pick(['Siesta time… 😴', 'Just resting my eyes…']) },
    { walk: CHAIR.front },
    { face: CHAIR.ahead },
    { act: 'nap', seconds: rand(45, 70), anchor: CHAIR.seat, anchorRate: 3, sleepy: true },
    { act: 'stretch', seconds: 2.2, look: 'camera' },
    { say: pick(['Ahh, much better.', 'Back to it!']) },
  ];
};

const logActivity = () => [
  { walk: LOG_SEAT.approach },
  { face: FIRE },
  { say: pick(['Ahh, this is the life.', 'Time for a break.', null]) },
  {
    act: 'sit',
    seconds: rand(10, 16),
    anchor: [LOG_SEAT.seat[0], LOG_SEAT.height + SIT_HIP, LOG_SEAT.seat[1]],
    look: (t) => (Math.sin(t * 0.5) > 0.3 ? 'camera' : [FIRE[0], 0.2, FIRE[1]]),
    motion: warmingHands,
  },
];

const laptopActivity = () => [
  { walk: SPOTS.laptop },
  { face: [KEYS.center[0], KEYS.center[2]] },
  { say: pick(['My work is on this laptop →', 'Come see what I build →', 'Projects are in here →']), seconds: 4.5, laptop: true },
  {
    act: 'type',
    seconds: rand(8, 11),
    anchor: kneelAt(KEYS.kneel),
    look: LAPTOP_FOCUS,
    pose: { arm_L: { reach: KEYS.left, pron: 1.1 }, arm_R: { reach: KEYS.right, pron: 1.1 } },
    motion: (t) => ({ arm_L: { flex: 0.08 * Math.sin(t * 17) }, arm_R: { flex: 0.08 * Math.cos(t * 19) } }),
  },
];

const viewActivity = () => {
  const out = [SPOTS.view[0] + CAM_DIR[0] * 5, SPOTS.view[1] + CAM_DIR[1] * 5];
  return [
    { walk: SPOTS.view },
    { face: out },
    { act: 'stretch', seconds: 2.4, look: [out[0], 3, out[1]] },
    { say: day.hour >= 17.5 && day.hour < 19 ? pick(['What a sunset! 🌅', 'Golden hour ✨']) : pick(['What a view! 🌴', 'Ahh, island life.']) },
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
      motion: (t) => {
        const push = 0.08 * Math.sin(t * 22);
        return { spine: { swing: push }, arm_L: { dir: [push, 0, 0] }, arm_R: { dir: [push, 0, 0] } };
      },
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

/**
 * Activities with how often he picks them at a given hour; `away` ones take
 * him off camp. Bedtime, building the fire and being woken aren't drawn at
 * random: chooseActivity and <Likeness /> send him to them.
 */
export const ACTIVITIES = {
  fire: { build: fireActivity, weight: () => (fire.fuel < 0.35 ? 6 : 1) },
  log: { build: logActivity, weight: (hour) => (hour >= 18 ? 2 : 1) },
  laptop: { build: laptopActivity, weight: () => 1.4 },
  view: { build: viewActivity, weight: (hour) => (hour >= 17.5 && hour < 19 ? 2 : 0.6) },
  nap: { build: napActivity, weight: (hour) => (isNapTime(hour) && performance.now() - naps.last > NAP_GAP ? 5 : 0) },
  coconut: { build: coconutActivity, weight: (hour) => (world.palms.length ? (isDaylight(hour) ? 1 : 0.3) : 0), away: true },
  swim: { build: swimActivity, weight: (hour) => (isDaylight(hour) ? 0.8 : 0), away: true },
  kayak: { build: kayakActivity, weight: (hour) => (kayak.rest && isDaylight(hour) ? 0.7 : 0), away: true },
  makeFire: { build: () => makeFireActivity(fireLine(day.hour)), weight: () => 0 },
  bedtime: { build: bedtimeActivity, weight: () => 0 },
  woken: { build: wokenActivity, weight: () => 0 },
};

/** Pick the next activity: bed at night, a cold fire rebuilt first, never the same twice, back to camp after an outing. */
export const chooseActivity = (last, hour) => {
  if (isSleepTime(hour)) return 'bedtime';
  if (fire.fuel <= 0 && last !== 'makeFire') return 'makeFire';
  const options = Object.entries(ACTIVITIES)
    .filter(([id]) => id !== last)
    .map(([id, a]) => [id, a.weight(hour) * (a.away && ACTIVITIES[last]?.away ? 0.15 : 1)]);
  let r = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of options) {
    r -= w;
    if (w > 0 && r <= 0) return id;
  }
  return 'laptop';
};
