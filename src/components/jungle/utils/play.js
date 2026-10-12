/*
 * Shared state for the island's little interactions (fire, coconuts, palms)
 * and the "discoveries" a visitor has found. Plain module state plus a tiny
 * event emitter, so 3D components and the DOM overlay can talk without
 * re-rendering the scene.
 */

/** Interactions to discover, in the order they're listed in the overlay. */
export const DISCOVERIES = [
  { id: 'stoke', label: 'Fed the campfire', hint: 'Tap the campfire' },
  { id: 'douse', label: 'Put the fire out', hint: 'Carry the mug over the fire' },
  { id: 'light', label: 'Struck a fire with flint', hint: 'Scrape the flint across the fire stones when the fire is out' },
  { id: 'shake', label: 'Shook a coconut loose', hint: 'Tap a palm tree' },
  { id: 'crack', label: 'Cracked a coconut', hint: 'Throw a coconut at a rock, or tap one a few times' },
  { id: 'burn', label: 'Set something alight', hint: 'Hold something in the flames' },
  { id: 'lantern', label: 'Switched the lantern', hint: 'Tap the lantern' },
  { id: 'fireflies', label: 'Led the fireflies', hint: 'Carry the lit lantern at night' },
];

const STORAGE_KEY = 'island-discoveries';

const listeners = new Map();

export const on = (type, fn) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type).delete(fn);
};

export const emit = (type, payload) => listeners.get(type)?.forEach((fn) => fn(payload));

const loadFound = () => {
  try {
    const ids = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(ids.filter((id) => DISCOVERIES.some((d) => d.id === id)));
  } catch {
    return new Set();
  }
};

const found = loadFound();

export const getFound = () => found;

/** Mark an interaction as found; the overlay shows a toast the first time. */
export const discover = (id) => {
  if (found.has(id)) return;
  found.add(id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...found]));
  } catch {
    // Storage unavailable (private mode etc.): progress just won't persist
  }
  const item = DISCOVERIES.find((d) => d.id === id);
  emit('discover', { id, label: item?.label });
};

/** A short message in the overlay (e.g. how to relight a dead fire). */
export const notify = (text) => emit('toast', { text });

/**
 * Props currently held by the pointer. Camera controls are paused while this
 * is non-empty; the camera rig turns them back on once it's empty, even if a
 * held prop vanished (e.g. a coconut cracked in hand) before it was released.
 */
export const held = new Set();

/**
 * Campfire state. `fuel` drives everything the fire draws: ~1 is a full fire,
 * below ~0.15 only embers glow, 0 is cold ash. `tinder` builds up from flint
 * strikes while the fire is cold and ignites it at 1.
 */
export const fire = {
  fuel: 1,
  tinder: 0,
  // Set by the mug when water lands on the fire; the campfire handles it
  doused: false,
  // Horizontal shove (m/s, accumulated since the last frame) from things
  // moving through the flames; the campfire bends its flames with it
  push: { x: 0, z: 0 },
};

/** Something moving at (vx, vz) m/s is passing through the flames this frame. */
export const stirFire = (vx, vz, dt) => {
  fire.push.x += vx * dt;
  fire.push.z += vz * dt;
};

/** Particle bursts (sparks, juice, water) drawn by <Bursts />. */
export const emitBurst = (options) => emit('burst', options);

const SPARK_COLOR = [5, 2.2, 0.6];

/** A flint strike at `position` (world): a shower of sparks, which build heat in a cold fire's tinder. */
export const strikeFlint = (position) => {
  emitBurst({ position, count: 14, color: SPARK_COLOR, speed: 1.6, up: 0.9, gravity: 4, life: 0.45, size: 0.007 });
  if (fire.fuel <= 0) fire.tinder = Math.min(1, fire.tinder + 0.22);
};
