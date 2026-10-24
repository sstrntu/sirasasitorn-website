/**
 * Central configuration for the island camp scene.
 *
 * Everything that controls layout, look and camera choreography lives here so
 * the scene can be re-arranged without digging through component code.
 * Units are meters (1 unit = 1 m) and the camp clearing is centered at the origin.
 */

export const ASSETS = {
  // Lighting only (no visible sky, faint and blurred into soft reflections): a 128x64 copy (32 KB) is plenty
  hdri: '/jungle/rainforest_trail_128.hdr',
  screen: '/jungle/screen.jpg',
  // Bare limestone rock models (Higgsfield image-to-3D, optimized with scripts/optimize-glb.py,
  // then Draco + WebP compressed: `npx @gltf-transform/cli optimize in.glb out.glb --compress draco
  // --texture-compress webp --texture-size 1024 --simplify false --flatten false --join false`).
  // Each is normalized to height 1 with its base at y = 0 and its front facing +Z.
  rocks: {
    karstA: '/jungle/models/karst-a.glb',
    karstB: '/jungle/models/karst-b.glb',
    seaStack: '/jungle/models/sea-stack.glb',
    // Low-poly (900 faces) copy of the sea stack for the many small boulders
    boulder: '/jungle/models/boulder.glb',
  },
  // Draco decoder for the compressed models, served from our own domain (copied from
  // three/examples/jsm/libs/draco/gltf): no extra connection to a CDN on a first visit.
  // Every useGLTF call must pass it: drei shares one decoder and each call sets its path.
  draco: '/jungle/draco/',
  // Tiling ground textures (Higgsfield-generated): lawn, beach sand, soil cross-section
  ground: {
    grass: '/jungle/ground/grass.webp',
    sand: '/jungle/ground/sand.webp',
    soil: '/jungle/ground/soil.webp',
  },
  // Ultralight backpacking tent (Higgsfield image-to-3D)
  tent: '/jungle/models/tent.glb',
  // Pixar-style Sira (Higgsfield image-to-3D, rigged with scripts/rig-sira.py), loaded once the
  // scene is ready. Bump ?v= when the file changes: browsers keep /jungle files for a week
  likeness: '/jungle/models/sira.glb?v=4',
  // Alpha-cutout foliage textures (Higgsfield-generated)
  foliage: {
    palmFrond: '/jungle/foliage/palm-frond.webp',
    leafCluster: '/jungle/foliage/leaf-cluster.webp',
  },
};

export const LAYOUT = {
  tent: { position: [-1.75, 0, -1.35], rotationY: 0.55 },
  table: { position: [0.55, 0, -0.1], rotationY: -0.3 },
  // Camp chair beside the tent, facing the campfire
  chair: { position: [0.1, 0, -1.45], rotationY: -0.24 },
  campfire: { position: [-0.55, 0, 1.25] },
  // Firewood stacked beside the stump, where Sira fetches logs to build the fire
  woodpile: { position: [2.4, 0, -0.55], rotationY: 0.9 },
  // Sira's water bucket, between the fire and the table, for putting the fire out at night
  bucket: { position: [-0.05, 0, 0.9] },
  // Sira, standing just behind the fire (as seen from the hero camera), clear of the
  // laptop dive path and the log seat
  likeness: { position: [-1.15, 0, 0.95], visible: true },
  // Radius around the origin kept free of foliage so the camp reads clearly
  clearingRadius: 2.7,
};

// Small backpacking table (Helinox Table One style): low roll-top on a pole frame
export const TABLE = {
  width: 0.72,
  depth: 0.48,
  height: 0.45,
  topThickness: 0.018,
};

export const LAPTOP = {
  // Position relative to the table top center
  offset: [-0.06, 0, 0.04],
  rotationY: 0.12,
  width: 0.312,
  depth: 0.221,
  baseThickness: 0.011,
  lidThickness: 0.0055,
  // Lid tilt back from vertical once open (radians)
  openTilt: 0.3,
};

/**
 * Overall look: AgX tone mapping (utils/toneMapping.js) and a soft grade
 * (Effects.js) keep colors calm and natural rather than neon.
 *  - exposure: brightness fed into the tone mapper (1 = neutral)
 *  - saturation / nightSaturation: grade by day and by night (-1..1, 0 = unchanged)
 *  - bloom: glow strength around the fire, lantern, screen and fireflies
 *  - groundSaturation / foliageSaturation: how much of the photo textures' own
 *    (very saturated) color is kept, for the lawn and soil / the leaves and
 *    fronds (1 = all of it)
 */
export const GRADE = {
  exposure: 1.0,
  saturation: 0,
  nightSaturation: -0.35,
  bloom: 0.4,
  groundSaturation: 0.8,
  foliageSaturation: 0.85,
};

// Sky, fog and light colors change with the time of day: see timeOfDay.js
/** Stylized palette: simple shapes with soft, natural colors. */
export const COLORS = {
  fire: '#ff7a2e',
  tent: '#f07a2a',
  tentDoor: '#3a2a20',
  // Grass tufts: soft sage greens that sit with the toned-down lawn texture
  grass: '#7fa65a',
  grassDark: '#6b944c',
  grassLight: '#98b56c',
  dirt: '#9a7a52',
  bark: '#8a5a34',
  barkDark: '#6e4628',
  leaf: '#55b432',
  leafDark: '#3c962c',
  leafLight: '#86cc3a',
  palmLeaf: '#7cc832',
  rock: '#a0948a',
  rockDark: '#857a71',
  moss: '#7cc23e',
  wood: '#b98a55',
  sand: '#f0d48c',
  sandWet: '#e2c486',
  limestone: '#ab9f93',
  limestoneGrey: '#95897e',
  limestoneOrange: '#b39070',
  limestoneDark: '#7c7168',
  jungle: '#4caa2e',
  jungleDark: '#358f2a',
  jungleLight: '#82c838',
  soil: ['#c47f38', '#a5622c', '#7c4a26', '#55504e'],
  // Soft aqua shallows, calm teal-blue further out
  waterShallow: '#8fd6cf',
  waterDeep: '#3f9cbf',
};

/**
 * The world is a floating diorama block (a "mini world"), Krabi style: a
 * jungle camp on a tropical island block with limestone karst towers at the
 * back, a waterfall into a pool, a stream, and a clear turquoise beach in
 * front. Units are meters; the camp is at the origin.
 */
/**
 * How spread out the world is around the camp. Layout positions below are
 * authored at scale 1 and multiplied by this, so the camp stays put while the
 * karsts, stream, beach and sea move outward (and the block grows).
 */
export const WORLD_SCALE = 1.6;
const spread = ([x, z]) => [x * WORLD_SCALE, z * WORLD_SCALE];

export const ISLAND = {
  // Block footprint: x and z both span [min, max]
  min: -12 * WORLD_SCALE,
  max: 16 * WORLD_SCALE,
  // Bottom of the soil cross-section
  bottom: -6.5,
  // Sea surface height (the land around the camp is at 0)
  waterLevel: -0.32,
  // Surface of the stream and the waterfall pool
  streamLevel: -0.12,
};

/**
 * Limestone karst towers (position [x, z], radius and height in meters).
 * Towers with `waterfallAngle` carry a waterfall down the cliff face facing
 * that compass direction (radians in the XZ plane); the model's front is
 * turned to face it. `turn` rotates the other towers (radians).
 */
export const KARSTS = [
  { position: spread([-7, -7]), radius: 4, height: 17, seed: 1, model: 'karstA', waterfallAngle: Math.PI / 4 },
  { position: spread([-1.5, -8.6]), radius: 2.7, height: 11.5, seed: 2, model: 'karstB', waterfallAngle: 0.74 },
  { position: spread([-8.8, -1.2]), radius: 2.5, height: 9, seed: 3, model: 'karstB', turn: 2.1 },
  // Sea stacks rising out of the water (one model, reused at different sizes and turns)
  { position: spread([13.6, 8.2]), radius: 1.6, height: 6.5, seed: 4, model: 'seaStack', turn: 0.4 },
  { position: spread([9.5, 14.2]), radius: 1.0, height: 4, seed: 5, model: 'seaStack', turn: 2.6 },
];

/** Where a karst's waterfall lands: just out from its face, along waterfallAngle. */
const fallLanding = (k, extra = 1.1) => [
  k.position[0] + Math.cos(k.waterfallAngle) * (k.radius + extra),
  k.position[1] + Math.sin(k.waterfallAngle) * (k.radius + extra),
];

/** Pool at the foot of the waterfall and the stream from it to the sea ([x, z] points). */
const POOL = fallLanding(KARSTS[0]);
export const STREAM = {
  // Pool under the main waterfall; the stream winds past the second fall to the sea
  pool: { position: POOL, radius: 1.7 },
  path: [POOL, ...[[-2.8, -6.4], [-0.4, -7.1], [2.2, -6.75], [5, -5.3], [7.8, -3.1], [10, -0.6], [12.5, 1.1], [15, 2.4]].map(spread)],
  width: 1.3,
};

/** Kayak pulled up on the beach ([x, z]); heading = compass direction its bow points (radians). */
export const KAYAK = { position: spread([6.9, 0.9]), heading: -Math.PI / 4 }; // lying along the shoreline

/** World-space center of the laptop screen: the camera's focus point. */
export const LAPTOP_FOCUS = (() => {
  const [tx, , tz] = LAYOUT.table.position;
  const [ox, , oz] = LAPTOP.offset;
  const a = LAYOUT.table.rotationY;
  // Rotate the laptop's table-local offset by the table's Y rotation
  const x = tx + ox * Math.cos(a) + oz * Math.sin(a);
  const z = tz - ox * Math.sin(a) + oz * Math.cos(a);
  return [x, TABLE.height + 0.1, z];
})();

export const CAMERA = {
  // Narrow FOV: less perspective distortion, so the block reads like a model
  fov: 30,
  near: 0.02,
  far: 600,
  // Resting shot after the intro: the camp in front of the waterfall cliffs,
  // orbiting around (and zooming toward) the laptop.
  // azimuth/elevation in radians (azimuth in the XZ plane), distance in meters
  // on a wide screen; narrow screens back off to keep the framing.
  hero: {
    target: LAPTOP_FOCUS,
    azimuth: 0.9,
    elevation: 0.42,
    distance: 15,
  },
  // Intro: opens on the whole floating block, holds a moment, then flies in
  // to the hero shot
  intro: {
    azimuth: 0.5,
    elevation: 0.68,
    distance: 150,
    hold: 1.0,
    duration: 4.0,
  },
  limits: {
    minDistance: 0.9,
    maxDistance: 200,
    minPolarAngle: 0.2,
    maxPolarAngle: 1.3,
  },
  // Camera flight into the laptop screen
  enter: {
    duration: 3.4,
    // How much of the viewport the screen should cover at the end (>1 overfills)
    screenFill: 1.04,
  },
  // Zoomed out of the desktop: the scene opens on the laptop screen (its
  // wallpaper framed like the desktop's), holds while the page's wallpaper
  // overlay fades, then pulls back out along the path in to the hero shot
  exit: {
    hold: 0.45,
    duration: 3.4,
  },
};

const isLowPowerDevice = () => {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow || coarse;
};

/**
 * Render settings. Phones get the same scene, but skip the post-processing
 * composer: mobile GPUs (iOS especially) produce NaN pixels in its half-float
 * buffers that bloom smears into black blobs, and without it the renderer's
 * own MSAA gives clean edges at a fraction of the cost. The saved GPU time
 * goes into a sharper pixel density instead.
 */
/**
 * Render settings for this device. `safe` is the lighter set the scene retries with when the
 * normal one crashes it (weak phones, in-app browsers): no shadows or antialiasing, at most
 * 1x resolution, fewer plants.
 */
export const getQuality = (safe = false) => {
  const mobile = safe || isLowPowerDevice();
  // Phones get the same scene with fewer small plants and no composer;
  // desktop counts scale with the larger world
  const n = (count) => Math.round(count * (safe ? 0.35 : mobile ? 0.6 : 1));
  return {
    mobile,
    safe,
    shadows: !safe,
    // Retina laptops render at 1.5x, not their full 2x: barely visible, far less GPU work
    dpr: safe ? [0.75, 1] : mobile ? [1, 2] : [1, 1.5],
    shadowMapSize: mobile ? 2048 : 4096,
    // The coarser mobile shadow map needs a larger offset to avoid acne (speckled tent and props)
    shadowNormalBias: mobile ? 0.08 : 0.04,
    fireShadows: !mobile,
    postprocessing: !mobile,
    // Composer settings (desktop only, see postprocessing above)
    ambientOcclusion: true,
    multisampling: 4,
    grassTufts: n(900),
    bushes: n(70),
    ferns: n(120),
    boulders: n(38),
    flowers: n(110),
    jungleTrees: n(80),
    rainTrees: 10,
    palms: n(30),
    bananas: n(22),
    fireflies: n(80),
  };
};

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
