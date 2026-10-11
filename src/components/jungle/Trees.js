import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ASSETS, CAMERA, COLORS, ISLAND, KAYAK } from './sceneConfig';
import { useTexture } from '@react-three/drei';
import { createFrondCardGeometry, createLeafClumpGeometry, createLeafMaterial } from './utils/foliageCards';
import { isDryLand, shoreCoordinate, terrainHeight } from './Island';
import { composeMatrix, createRandom, createTaperedTube, randRange } from './utils/geometry';

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

const InstancedSet = ({ geometry, material, matrices, colors, castShadow, receiveShadow }) => {
  const ref = useRef();
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
      raycast={noRaycast}
    />
  );
};

const JUNGLE_GREENS = [COLORS.jungle, COLORS.jungleDark, COLORS.jungleLight, COLORS.leaf];
const greenFrom = (rand, palette = JUNGLE_GREENS) =>
  new THREE.Color(palette[Math.floor(rand() * palette.length)]).multiplyScalar(randRange(rand, 0.9, 1.08));

/** Coconut palms: curved trunks leaning toward the sea, instanced fronds and coconuts. */
const buildPalms = (count) => {
  const rand = createRandom(5);
  const trunks = [];
  const fronds = [];
  const frondColors = [];
  const nuts = [];
  const colliders = [];
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
    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
      const yaw = (f / frondCount) * Math.PI * 2 + rand() * 0.3;
      composeMatrix(m, [top.x, top.y, top.z], [randRange(rand, -0.45, 0.2), yaw, randRange(rand, -0.15, 0.15)], randRange(rand, 0.75, 1.0));
      fronds.push(m.clone());
      frondColors.push(new THREE.Color(rand() < 0.2 ? '#9cc24a' : COLORS.palmLeaf).multiplyScalar(randRange(rand, 0.85, 1.1)));
    }
    // A cluster of coconuts under the crown
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + rand();
      composeMatrix(m, [top.x + Math.cos(a) * 0.14, top.y - 0.12, top.z + Math.sin(a) * 0.14], [0, 0, 0], 0.1);
      nuts.push(m.clone());
    }
  });

  return { trunkGeometry: mergeGeometries(trunks), fronds, frondColors, nuts, colliders };
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

  return (
    <group>
      <mesh geometry={palms.trunkGeometry} material={materials.palmBark} castShadow receiveShadow raycast={noRaycast} />
      <InstancedSet geometry={geometries.frond} material={materials.frond} matrices={palms.fronds} colors={tints.fronds} castShadow />
      <InstancedSet geometry={geometries.nut} material={materials.nut} matrices={palms.nuts} castShadow />

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
