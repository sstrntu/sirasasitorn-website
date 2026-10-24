/*
 * Walking routes for Sira around the island: obstacles are circles on the
 * ground (camp furniture, the log as a row of circles, tree trunks published
 * by <Trees />, karst towers), and a route is the shortest chain of straight
 * segments that clears them: a small visibility graph of points ringed
 * around the obstacles near the trip.
 */
import { KARSTS, KAYAK, LAYOUT } from '../sceneConfig';
import { isInside } from '../Island';
import { world } from './play';

const [FIRE_X, , FIRE_Z] = LAYOUT.campfire.position;

// The log bench (CampProps): 1.8 m long along (0.707, 0.707) through this point
const LOG_CENTER = [FIRE_X - 0.8, FIRE_Z + 0.8];
const LOG_AXIS = [Math.SQRT1_2, Math.SQRT1_2];

/** Fixed ground obstacles as { x, z, r } (meters). */
const CAMP = [
  { x: FIRE_X, z: FIRE_Z, r: 0.5 },
  { x: LAYOUT.tent.position[0], z: LAYOUT.tent.position[2], r: 1.05 },
  { x: LAYOUT.table.position[0], z: LAYOUT.table.position[2], r: 0.5 },
  { x: LAYOUT.chair.position[0], z: LAYOUT.chair.position[2], r: 0.42 },
  // Stump with the axe, the woodpile, the bucket and the three boulders (CampProps, Bucket)
  { x: 1.75, z: -1.25, r: 0.42 },
  { x: LAYOUT.woodpile.position[0], z: LAYOUT.woodpile.position[2], r: 0.36 },
  { x: LAYOUT.bucket.position[0], z: LAYOUT.bucket.position[2], r: 0.18 },
  { x: 2.9, z: -2.4, r: 0.95 },
  { x: -3.5, z: 1.7, r: 0.75 },
  { x: 3.4, z: 1.2, r: 0.5 },
  ...[-0.6, 0, 0.6].map((t) => ({ x: LOG_CENTER[0] + LOG_AXIS[0] * t, z: LOG_CENTER[1] + LOG_AXIS[1] * t, r: 0.3 })),
  ...KARSTS.map((k) => ({ x: k.position[0], z: k.position[1], r: k.radius * 1.15 })),
];
/** The beached kayak, unless he's taking it out. */
const KAYAK_OBSTACLE = { x: KAYAK.position[0], z: KAYAK.position[1], r: 1.2 };

const MARGIN = 0.22;
/** Only obstacles this close to the straight line of a trip are routed around. */
const CORRIDOR = 3;

const inside = (p, o, pad = 0) => (p[0] - o.x) ** 2 + (p[1] - o.z) ** 2 < (o.r + pad) ** 2;

const segmentDistance2 = (a, b, x, z) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
  const px = a[0] + dx * t - x;
  const pz = a[1] + dz * t - z;
  return px * px + pz * pz;
};

const clear = (a, b, obstacles) => obstacles.every((o) => segmentDistance2(a, b, o.x, o.z) >= o.r * o.r);

/**
 * Route from `from` to `to` ([x, z] each) as a list of points to walk to,
 * ending at `to`. Obstacles either end stands in (e.g. the log he sits on)
 * are ignored, so he can leave or reach a spot inside one.
 */
export const findPath = (from, to, { withKayak = true } = {}) => {
  const all = [...CAMP, ...world.trees, ...(withKayak ? [KAYAK_OBSTACLE] : [])];
  const obstacles = all.filter(
    (o) => !inside(from, o) && !inside(to, o) && segmentDistance2(from, to, o.x, o.z) < (CORRIDOR + o.r) ** 2
  );
  if (clear(from, to, obstacles)) return [to];
  const nodes = obstacles
    .flatMap((o) =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return [o.x + Math.cos(a) * (o.r + MARGIN), o.z + Math.sin(a) * (o.r + MARGIN)];
      })
    )
    .filter((p) => isInside(p[0], p[1], 0.5) && !obstacles.some((o) => inside(p, o)));
  const pts = [from, ...nodes, to];
  const n = pts.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[0] = 0;
  // Dijkstra over the visibility graph (a few dozen points, so a plain O(n^2) scan)
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    if (u === n - 1) break;
    for (let v = 0; v < n; v++) {
      if (done[v] || !clear(pts[u], pts[v], obstacles)) continue;
      const d = dist[u] + Math.hypot(pts[v][0] - pts[u][0], pts[v][1] - pts[u][1]);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[n - 1] < 0) return [to]; // no clear route: walk straight
  const route = [];
  for (let v = n - 1; v > 0; v = prev[v]) route.unshift(pts[v]);
  return route;
};

/** Seat on the log, facing the fire: stand in front first, then step back onto it. */
export const LOG_SEAT = {
  seat: [LOG_CENTER[0] - LOG_AXIS[0] * 0.25 + 0.04, LOG_CENTER[1] - LOG_AXIS[1] * 0.25 - 0.04],
  approach: [LOG_CENTER[0] - LOG_AXIS[0] * 0.25 + 0.4, LOG_CENTER[1] - LOG_AXIS[1] * 0.25 - 0.4],
  // Height of the log's top (m)
  height: 0.3,
};
