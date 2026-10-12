import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ASSETS, CAMERA, COLORS, ISLAND, KAYAK } from './sceneConfig';
import { useTexture } from '@react-three/drei';
import { createFrondCardGeometry, createLeafClumpGeometry, createLeafMaterial } from './utils/foliageCards';
import { isDryLand, shoreCoordinate, terrainHeight } from './Island';
import { composeMatrix, createRandom, createTaperedTube, randRange } from './utils/geometry';
import { discover, emit } from './utils/play';

/*
 * Krabi-style tropical trees with photo-textured foliage (leaf-card clumps and palm frond cards):
 *  - coconut palms lining the beach, leaning out over the water
 *  - rain trees with wide umbrella crowns
 *  - dense round-crowned jungle trees around the karsts and the block's edges
 *  - banana plants at the jungle's edge
 * The camp clearing and the hero camera's sight line to it stay open.
 */

// Direction from the camp toward the hero camera (XZ plane)
const CAMERA_DIR = new THREE.Vector2(Math.cos(CAMERA.hero.azimuth), Math.sin(CAMERA.hero.azimuth));
// Direction out to sea (the shore coordinate grows along x + z)
const SEA_DIR = new THREE.Vector2(1, 1).normalize();

/** Keep tall plants out of the camp and out of the camera's view of it. */
const blocksCamp = (x, z, clearing) => {
  const r = Math.hypot(x, z);
  if (r < clearing) return true;
  // Keep the beach around the kayak clear
  if (Math.hypot(x - KAYAK.position[0], z - KAYAK.position[1]) < 2.4) return true;
  const along = x * CAMERA_DIR.x + z * CAMERA_DIR.y;
  const across = Math.abs(x * CAMERA_DIR.y - z * CAMERA_DIR.x);
  return along > 0 && along < 11 && across < 3.2;
};

/** Random spots that pass `accept(x, z)`. */
const scatter = (rand, count, accept) => {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 400) {
    const x = randRange(rand, ISLAND.min, ISLAND.max);
    const z = randRange(rand, ISLAND.min, ISLAND.max);
    if (accept(x, z) && out.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > 1.1)) out.push([x, z]);
  }
  return out;
};

// Decorative meshes skip pointer hit-testing
const noRaycast = () => null;

const InstancedSet = ({ geometry, material, matrices, colors, castShadow, receiveShadow, meshRef, ...events }) => {
  const ownRef = useRef();
  const ref = meshRef || ownRef;
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    if (colors) {
      colors.forEach((c, i) => ref.current.setColorAt(i, c));
      ref.current.instanceColor.needsUpdate = true;
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [matrices, colors]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
      // Only sets with pointer handlers (the palm fronds) need hit-testing
      raycast={events.onClick ? undefined : noRaycast}
      {...events}
    />
  );
};

const JUNGLE_GREENS = [COLORS.jungle, COLORS.jungleDark, COLORS.jungleLight, COLORS.leaf];
const greenFrom = (rand, palette = JUNGLE_GREENS) =>
  new THREE.Color(palette[Math.floor(rand() * palette.length)]).multiplyScalar(randRange(rand, 0.9, 1.08));

const FRONDS_PER_PALM = 10;
const NUTS_PER_PALM = 3;
/** Seconds before a palm that's been shaken bare grows its coconuts back. */
const NUT_REGROW = 25;
const SHAKE_SECONDS = 1.6;

/** Coconut palms: curved trunks leaning toward the sea, instanced fronds and coconuts. */
const buildPalms = (count) => {
  const rand = createRandom(5);
  const trunks = [];
  const fronds = [];
  const frondColors = [];
  const nuts = [];
  const colliders = [];
  const info = []; // per palm: trunk sample points and crown top, for tapping and shaking
  const m = new THREE.Matrix4();

  // Most along the beach, a few inland
  const beach = scatter(rand, Math.round(count * 0.75), (x, z) => {
    const s = shoreCoordinate(x, z);
    return s > 7 && s < 10.6 && isDryLand(x, z, 0.8) && !blocksCamp(x, z, 3.5);
  });
  const inland = scatter(rand, count - beach.length, (x, z) => isDryLand(x, z, 0.8) && shoreCoordinate(x, z) < 6 && !blocksCamp(x, z, 4.5));

  [...beach, ...inland].forEach(([x, z], index) => {
    const y = terrainHeight(x, z);
    const h = randRange(rand, 4.5, 7);
    // Beach palms lean out over the water; inland ones lean randomly
    const leanAngle = index < beach.length ? Math.atan2(SEA_DIR.y, SEA_DIR.x) + randRange(rand, -0.6, 0.6) : rand() * Math.PI * 2;
    const leanAmount = index < beach.length ? randRange(rand, 1.2, 2.6) : randRange(rand, 0.3, 1);
    const points = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      points.push(new THREE.Vector3(x + Math.cos(leanAngle) * leanAmount * t * t, y - 0.1 + h * t, z + Math.sin(leanAngle) * leanAmount * t * t));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    trunks.push(createTaperedTube(curve, { radiusStart: 0.17, radiusEnd: 0.1, tubularSegments: 10, radialSegments: 6, flare: 0.12 }));
    colliders.push({ position: [x, y + 1.2, z], radius: 0.18 });

    const top = curve.getPointAt(1);
    info.push({ points: curve.getSpacedPoints(12), top });
    const frondCount = FRONDS_PER_PALM;
    for (let f = 0; f < frondCount; f++) {
      const yaw = (f / frondCount) * Math.PI * 2 + rand() * 0.3;
      composeMatrix(m, [top.x, top.y, top.z], [randRange(rand, -0.45, 0.2), yaw, randRange(rand, -0.15, 0.15)], randRange(rand, 0.75, 1.0));
      fronds.push(m.clone());
      frondColors.push(new THREE.Color(rand() < 0.2 ? '#9cc24a' : COLORS.palmLeaf).multiplyScalar(randRange(rand, 0.85, 1.1)));
    }
    // A cluster of coconuts under the crown
    for (let c = 0; c < NUTS_PER_PALM; c++) {
      const a = (c / NUTS_PER_PALM) * Math.PI * 2 + rand();
      composeMatrix(m, [top.x + Math.cos(a) * 0.14, top.y - 0.12, top.z + Math.sin(a) * 0.14], [0, 0, 0], 0.1);
      nuts.push(m.clone());
    }
  });

  return { trunkGeometry: mergeGeometries(trunks), fronds, frondColors, nuts, colliders, info };
};

/** Rain trees: short sturdy trunks forking into wide, flat umbrella crowns. */
const buildRainTrees = (count) => {
  const rand = createRandom(19);
  const trunks = [];
  const crowns = [];
  const crownColors = [];
  const colliders = [];
  const m = new THREE.Matrix4();
  scatter(rand, count, (x, z) => isDryLand(x, z, 2) && shoreCoordinate(x, z) < 4 && !blocksCamp(x, z, 6)).forEach(([x, z]) => {
    const y = terrainHeight(x, z);
    const h = randRange(rand, 3.2, 4.5);
    const top = new THREE.Vector3(x, y + h, z);
    trunks.push(createTaperedTube(new THREE.LineCurve3(new THREE.Vector3(x, y - 0.2, z), top), { radiusStart: 0.32, radiusEnd: 0.18, tubularSegments: 3, radialSegments: 7, flare: 0.4 }));
    colliders.push({ position: [x, y + 1.2, z], radius: 0.32 });
    const spread = randRange(rand, 1.6, 2.2);
    // Forking limbs out to the umbrella
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + rand();
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * spread * 0.55, randRange(rand, 0.8, 1.3), Math.sin(a) * spread * 0.55));
      trunks.push(createTaperedTube(new THREE.LineCurve3(top.clone().add(new THREE.Vector3(0, -0.4, 0)), end), { radiusStart: 0.16, radiusEnd: 0.07, tubularSegments: 2, radialSegments: 5 }));
    }
    const color = greenFrom(rand, [COLORS.jungle, COLORS.leaf, COLORS.jungleLight]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand();
      const r = i === 0 ? 0 : spread * randRange(rand, 0.4, 0.7);
      const s = i === 0 ? spread * 0.85 : spread * randRange(rand, 0.45, 0.6);
      composeMatrix(m, [x + Math.cos(a) * r, top.y + 1.3 + randRange(rand, -0.15, 0.25), z + Math.sin(a) * r], [0, rand() * Math.PI, 0], [s, s * 0.38, s]);
      crowns.push(m.clone());
      crownColors.push(color.clone().multiplyScalar(randRange(rand, 0.9, 1.08)));
    }
  });
  return { trunkGeometry: mergeGeometries(trunks), crowns, crownColors, colliders };
};

/** Dense jungle: round-crowned trees packed around the karsts and the block's back edges. */
const buildJungle = (count) => {
  const rand = createRandom(1234);
  const trunks = [];
  const crowns = [];
  const crownColors = [];
  const m = new THREE.Matrix4();
  // Thicker toward the back (karsts) and the sides, open toward the beach
  scatter(rand, count, (x, z) => {
    if (!isDryLand(x, z, 0.5) || blocksCamp(x, z, 6.2)) return false;
    const s = shoreCoordinate(x, z);
    return s < 5 && rand() < THREE.MathUtils.smoothstep(-s, -5, 8) + 0.15;
  }).forEach(([x, z]) => {
    const y = terrainHeight(x, z);
    const h = randRange(rand, 2.5, 5.5);
    composeMatrix(m, [x, y + h / 2 - 0.1, z], [0, 0, 0], [0.22, h, 0.22]);
    trunks.push(m.clone());
    const s = randRange(rand, 1.1, 1.6);
    const color = greenFrom(rand);
    // One big round crown with a smaller bump or two
    for (let i = 0; i < 2; i++) {
      const o = i === 0 ? [0, 0, 0] : [randRange(rand, -0.6, 0.6) * s, randRange(rand, -0.5, 0.1) * s, randRange(rand, -0.6, 0.6) * s];
      const k = i === 0 ? s : s * randRange(rand, 0.5, 0.65);
      composeMatrix(m, [x + o[0], y + h + s * 0.3 + o[1], z + o[2]], [0, rand() * Math.PI, 0], [k, k * 0.85, k]);
      crowns.push(m.clone());
      crownColors.push(color.clone().multiplyScalar(randRange(rand, 0.92, 1.06)));
    }
  });
  return { trunks, crowns, crownColors };
};

/** Banana plants: a short stem with a few big paddle leaves. */
const buildBananas = (count) => {
  const rand = createRandom(61);
  const stems = [];
  const leaves = [];
  const leafColors = [];
  const m = new THREE.Matrix4();
  scatter(rand, count, (x, z) => {
    const r = Math.hypot(x, z);
    return isDryLand(x, z, 0.8) && r > 3.6 && r < 9 && shoreCoordinate(x, z) < 7 && !blocksCamp(x, z, 3.6);
  }).forEach(([x, z]) => {
    const y = terrainHeight(x, z);
    const h = randRange(rand, 0.9, 1.5);
    composeMatrix(m, [x, y + h / 2, z], [0, 0, 0], [0.09, h, 0.09]);
    stems.push(m.clone());
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      composeMatrix(m, [x, y + h, z], [randRange(rand, -0.9, -0.3), (i / n) * Math.PI * 2 + rand() * 0.4, 0], randRange(rand, 0.8, 1.1));
      leaves.push(m.clone());
      leafColors.push(new THREE.Color(rand() < 0.25 ? '#a6cf55' : '#7cc44a').multiplyScalar(randRange(rand, 0.85, 1.05)));
    }
  });
  return { stems, leaves, leafColors };
};

/**
 * Break each round crown into a few smaller leaf clumps jittered around it,
 * so canopies read as masses of foliage rather than single balls.
 */
const toLeafClumps = (matrices, colors, seed, perCrown = 4) => {
  const rand = createRandom(seed);
  const out = { matrices: [], colors: [] };
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const m = new THREE.Matrix4();
  matrices.forEach((crown, i) => {
    crown.decompose(p, q, sc);
    for (let k = 0; k < perCrown; k++) {
      const s = sc.x * randRange(rand, 0.55, 0.75);
      const o = k === 0 ? [0, sc.y * 0.15, 0] : [randRange(rand, -0.55, 0.55) * sc.x, randRange(rand, -0.25, 0.3) * sc.y, randRange(rand, -0.55, 0.55) * sc.z];
      composeMatrix(m, [p.x + o[0], p.y + o[1], p.z + o[2]], [randRange(rand, -0.3, 0.3), rand() * Math.PI * 2, randRange(rand, -0.3, 0.3)], [s, s * (sc.y / sc.x), s]);
      out.matrices.push(m.clone());
      // Textures carry the real color; the instance tint only nudges it
      out.colors.push(colors[i].clone().lerp(new THREE.Color('#ffffff'), 0.7).multiplyScalar(randRange(rand, 1.15, 1.4)));
    }
  });
  return out;
};

/**
 * Tap a palm (trunk or fronds) to shake it: the fronds rustle around the
 * crown and one of its coconuts drops (picked up by <Coconuts /> as a real,
 * throwable coconut). Bare palms regrow their coconuts after a while.
 */
const usePalmShaking = (palms, frondRef, nutRef) => {
  // Per palm: when the current shake started, and which coconuts have dropped
  const state = useMemo(() => palms.info.map(() => ({ shakeAt: -Infinity, dropped: [], bareAt: 0 })), [palms]);
  const clock = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const pivot = useMemo(() => ({ to: new THREE.Matrix4(), from: new THREE.Matrix4(), rot: new THREE.Matrix4(), axis: new THREE.Vector3() }), []);
  const hidden = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  const shake = (index) => {
    const palm = state[index];
    const t = clock.current;
    if (t - palm.shakeAt < 0.4) return; // let a shake get going before the next tap counts
    palm.shakeAt = t;
    const left = [...Array(NUTS_PER_PALM).keys()].filter((c) => !palm.dropped.includes(c));
    if (!left.length) return;
    const c = left[Math.floor(Math.random() * left.length)];
    palm.dropped.push(c);
    if (palm.dropped.length === NUTS_PER_PALM) palm.bareAt = t;
    const nutIndex = index * NUTS_PER_PALM + c;
    const p = new THREE.Vector3().setFromMatrixPosition(palms.nuts[nutIndex]);
    nutRef.current.setMatrixAt(nutIndex, hidden);
    nutRef.current.instanceMatrix.needsUpdate = true;
    emit('coconutDrop', { position: [p.x, p.y, p.z] });
    discover('shake');
  };

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 1 / 20);
    const t = clock.current;
    let frondsChanged = false;
    let nutsChanged = false;
    state.forEach((palm, index) => {
      const age = t - palm.shakeAt;
      if (palm.dropped.length === NUTS_PER_PALM && t - palm.bareAt > NUT_REGROW) {
        palm.dropped = [];
        for (let c = 0; c < NUTS_PER_PALM; c++) nutRef.current.setMatrixAt(index * NUTS_PER_PALM + c, palms.nuts[index * NUTS_PER_PALM + c]);
        nutsChanged = true;
      }
      if (age > SHAKE_SECONDS + 0.1) return;
      // Damped sway of the whole crown around its top, settling back to rest
      const { top } = palms.info[index];
      const sway = age < SHAKE_SECONDS ? Math.sin(age * 16) * 0.12 * Math.exp(-age * 2.8) : 0;
      pivot.axis.set(Math.cos(index), 0, Math.sin(index)).normalize();
      pivot.to.makeTranslation(top.x, top.y, top.z);
      pivot.from.makeTranslation(-top.x, -top.y, -top.z);
      pivot.rot.makeRotationAxis(pivot.axis, sway);
      const swing = pivot.to.clone().multiply(pivot.rot).multiply(pivot.from);
      for (let f = 0; f < FRONDS_PER_PALM; f++) {
        const i = index * FRONDS_PER_PALM + f;
        frondRef.current.setMatrixAt(i, m.multiplyMatrices(swing, palms.fronds[i]));
      }
      frondsChanged = true;
      for (let c = 0; c < NUTS_PER_PALM; c++) {
        if (palm.dropped.includes(c)) continue;
        const i = index * NUTS_PER_PALM + c;
        nutRef.current.setMatrixAt(i, m.multiplyMatrices(swing, palms.nuts[i]));
        nutsChanged = true;
      }
    });
    if (frondsChanged) frondRef.current.instanceMatrix.needsUpdate = true;
    if (nutsChanged) nutRef.current.instanceMatrix.needsUpdate = true;
  });

  return shake;
};

/** Which palm a tap on the trunk mesh hit: the one whose trunk passes closest to the hit point. */
const nearestPalm = (info, point) => {
  let best = 0;
  let bestDistance = Infinity;
  info.forEach((palm, index) => {
    palm.points.forEach((p) => {
      const d = p.distanceToSquared(point);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    });
  });
  return best;
};

const setCursor = (cursor) => (e) => {
  e.stopPropagation();
  document.body.style.cursor = cursor;
};

/** Palm frond tints: near white so the photo texture shows, with a few yellowed fronds. */
const frondTints = (colors) => colors.map((c, i) => new THREE.Color(i % 7 === 0 ? '#e8e0a0' : '#ffffff').multiplyScalar(0.9 + (c.g % 0.2)));

const Trees = ({ quality }) => {
  const palms = useMemo(() => buildPalms(quality.palms), [quality.palms]);
  const rainTrees = useMemo(() => buildRainTrees(quality.rainTrees), [quality.rainTrees]);
  const jungle = useMemo(() => buildJungle(quality.jungleTrees), [quality.jungleTrees]);
  const bananas = useMemo(() => buildBananas(quality.bananas), [quality.bananas]);
  const maps = useTexture({ frond: ASSETS.foliage.palmFrond, leaves: ASSETS.foliage.leafCluster });

  const canopies = useMemo(
    () => ({
      rain: toLeafClumps(rainTrees.crowns, rainTrees.crownColors, 31, 3),
      jungle: toLeafClumps(jungle.crowns, jungle.crownColors, 32, 4),
    }),
    [rainTrees, jungle]
  );

  const tints = useMemo(() => ({ fronds: frondTints(palms.frondColors), bananas: frondTints(bananas.leafColors) }), [palms, bananas]);

  const geometries = useMemo(
    () => ({
      clump: createLeafClumpGeometry(10),
      frond: createFrondCardGeometry({ length: 2.1, width: 1.0, segments: 8, droop: 0.9 }),
      bananaLeaf: createFrondCardGeometry({ length: 1.1, width: 0.7, segments: 5, droop: 0.6 }),
      stick: new THREE.CylinderGeometry(0.7, 1, 1, 8),
      nut: new THREE.IcosahedronGeometry(1, 1),
    }),
    []
  );

  const materials = useMemo(
    () => ({
      bark: new THREE.MeshStandardMaterial({ color: '#6e5a48', roughness: 0.95 }),
      palmBark: new THREE.MeshStandardMaterial({ color: '#a08a6e', roughness: 0.95 }),
      leaves: createLeafMaterial(maps.leaves, { amplitude: 0.02, frequency: 0.9 }),
      frond: createLeafMaterial(maps.frond, { amplitude: 0.03, frequency: 1.3 }),
      stem: new THREE.MeshStandardMaterial({ color: '#7a8f4a', roughness: 0.9 }),
      jungleTrunk: new THREE.MeshStandardMaterial({ color: '#5a4a3c', roughness: 1 }),
      nut: new THREE.MeshStandardMaterial({ color: '#5e5024', roughness: 0.8 }),
    }),
    [maps]
  );

  const colliders = useMemo(() => [...palms.colliders, ...rainTrees.colliders], [palms, rainTrees]);

  const frondRef = useRef();
  const nutRef = useRef();
  const shakePalm = usePalmShaking(palms, frondRef, nutRef);
  const palmEvents = {
    onClick: (e) => {
      if (e.delta > 6) return; // a camera drag, not a tap
      e.stopPropagation();
      const index = e.object === frondRef.current ? Math.floor(e.instanceId / FRONDS_PER_PALM) : nearestPalm(palms.info, e.point);
      shakePalm(index);
    },
    onPointerOver: setCursor('pointer'),
    onPointerOut: setCursor(''),
  };
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    []
  );

  return (
    <group>
      <mesh geometry={palms.trunkGeometry} material={materials.palmBark} castShadow receiveShadow {...palmEvents} />
      <InstancedSet meshRef={frondRef} geometry={geometries.frond} material={materials.frond} matrices={palms.fronds} colors={tints.fronds} castShadow {...palmEvents} />
      <InstancedSet meshRef={nutRef} geometry={geometries.nut} material={materials.nut} matrices={palms.nuts} castShadow />

      <mesh geometry={rainTrees.trunkGeometry} material={materials.bark} castShadow receiveShadow raycast={noRaycast} />
      <InstancedSet geometry={geometries.clump} material={materials.leaves} matrices={canopies.rain.matrices} colors={canopies.rain.colors} castShadow receiveShadow />

      <InstancedSet geometry={geometries.stick} material={materials.jungleTrunk} matrices={jungle.trunks} castShadow />
      <InstancedSet geometry={geometries.clump} material={materials.leaves} matrices={canopies.jungle.matrices} colors={canopies.jungle.colors} castShadow receiveShadow />

      <InstancedSet geometry={geometries.stick} material={materials.stem} matrices={bananas.stems} castShadow />
      <InstancedSet geometry={geometries.bananaLeaf} material={materials.frond} matrices={bananas.leaves} colors={tints.bananas} castShadow />

      {/* Trunk colliders so tossed props hit the nearby trees */}
      {colliders.map((c, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={c.position}>
          <CylinderCollider args={[1.2, c.radius]} />
        </RigidBody>
      ))}
    </group>
  );
};

export { blocksCamp };
export default React.memo(Trees);
