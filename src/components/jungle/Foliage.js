import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ASSETS, COLORS, ISLAND, KAYAK, LAYOUT } from './sceneConfig';
import { isDryLand, sandAmount, shoreCoordinate, terrainHeight } from './Island';
import { blocksCamp } from './Trees';
import { composeMatrix, createGrassBladeGeometry, createRandom, randRange } from './utils/geometry';
import { useTexture } from '@react-three/drei';
import { createFrondCardGeometry, createLeafClumpGeometry, createLeafMaterial } from './utils/foliageCards';
import { applyWind } from './utils/wind';

/*
 * Stylized undergrowth on the island's dry land: a few grass tufts, round
 * tropical shrubs and leafy ferns at the jungle's edge, and scattered flowers.
 */

/** Keep plants on dry land, out of the camp itself and the tent. */
const isBlocked = (x, z, { clearing = LAYOUT.clearingRadius, camera = true } = {}) => {
  if (!isDryLand(x, z, 0.3)) return true;
  if (camera ? blocksCamp(x, z, clearing) : Math.hypot(x, z) < clearing) return true;
  const [tx, , tz] = LAYOUT.tent.position;
  if (Math.hypot(x - KAYAK.position[0], z - KAYAK.position[1]) < 2.0) return true;
  return Math.hypot(x - tx, z - tz) < 1.6;
};

/** Random points on the block that pass `isBlocked`; `accept` adds extra rules. */
const scatter = (rand, count, options, accept = () => true) => {
  const points = [];
  let guard = 0;
  while (points.length < count && guard++ < count * 40) {
    const x = randRange(rand, ISLAND.min, ISLAND.max);
    const z = randRange(rand, ISLAND.min, ISLAND.max);
    if (!isBlocked(x, z, options) && accept(x, z)) points.push([x, terrainHeight(x, z), z]);
  }
  return points;
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

/** A small tuft of soft, wide blades, merged into one geometry. */
const createGrassTuft = () => {
  const rand = createRandom(77);
  const blades = [];
  for (let i = 0; i < 5; i++) {
    const blade = createGrassBladeGeometry({ height: randRange(rand, 0.16, 0.28), width: 0.06, segments: 3, bend: randRange(rand, 0.04, 0.1) });
    const m = new THREE.Matrix4();
    composeMatrix(m, [randRange(rand, -0.05, 0.05), 0, randRange(rand, -0.05, 0.05)], [randRange(rand, -0.25, 0.25), (i / 5) * Math.PI * 2, randRange(rand, -0.2, 0.2)], 1);
    blades.push(blade.applyMatrix4(m));
  }
  return mergeGeometries(blades);
};

const tint = (rand, palette, min = 0.9, max = 1.08) =>
  new THREE.Color(palette[Math.floor(rand() * palette.length)]).multiplyScalar(randRange(rand, min, max));

const buildGrass = (count) => {
  const rand = createRandom(55);
  const m = new THREE.Matrix4();
  const out = { matrices: [], colors: [] };
  scatter(rand, count, { clearing: 2.6, camera: false }, (x, z) => sandAmount(x, z) < 0.5).forEach(([x, y, z]) => {
    composeMatrix(m, [x, y, z], [0, rand() * Math.PI * 2, 0], randRange(rand, 0.7, 1.2));
    out.matrices.push(m.clone());
    out.colors.push(tint(rand, [COLORS.grass, COLORS.grassLight, COLORS.grassDark]));
  });
  return out;
};

/** Round tropical shrubs at the jungle's edge, built from 2–3 faceted blobs each. */
const buildBushes = (count) => {
  const rand = createRandom(88);
  const m = new THREE.Matrix4();
  const out = { matrices: [], colors: [] };
  scatter(rand, count, { clearing: 3.4 }, (x, z) => shoreCoordinate(x, z) < 8.5 && Math.hypot(x, z) > 4.2).forEach(([x, y, z]) => {
    const size = randRange(rand, 0.6, 1.2);
    const color = tint(rand, [COLORS.jungle, COLORS.jungleDark, COLORS.jungleLight, COLORS.leaf]);
    const blobs = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < blobs; i++) {
      const s = size * (i === 0 ? 1 : randRange(rand, 0.55, 0.8));
      composeMatrix(m, [x + randRange(rand, -0.6, 0.6) * size, y + s * 0.55, z + randRange(rand, -0.6, 0.6) * size], [0, rand() * Math.PI, 0], [s, s * 0.85, s]);
      out.matrices.push(m.clone());
      out.colors.push(color.clone().multiplyScalar(randRange(rand, 0.92, 1.06)));
    }
  });
  return out;
};

/** Low leafy ferns around the camp and along the jungle's edge. */
const buildFerns = (count) => {
  const rand = createRandom(141);
  const m = new THREE.Matrix4();
  const out = { matrices: [], colors: [] };
  scatter(rand, count, { clearing: 3.2 }, (x, z) => shoreCoordinate(x, z) < 8.6 && Math.hypot(x, z) > 3.2).forEach(([x, y, z]) => {
    const color = tint(rand, ['#5fbf3a', '#7fd148', '#4aa83a']);
    const fronds = 6 + Math.floor(rand() * 3);
    const size = randRange(rand, 0.8, 1.4);
    for (let i = 0; i < fronds; i++) {
      composeMatrix(m, [x, y, z], [randRange(rand, -0.5, -0.1), (i / fronds) * Math.PI * 2 + rand() * 0.5, 0], size * randRange(rand, 0.8, 1.1));
      out.matrices.push(m.clone());
      out.colors.push(color.clone().multiplyScalar(randRange(rand, 0.92, 1.06)));
    }
  });
  return out;
};

/** Small flowers dotted through the grass. */
const buildFlowers = (count) => {
  const rand = createRandom(99);
  const m = new THREE.Matrix4();
  const out = { matrices: [], colors: [] };
  // Frangipani white/yellow, bougainvillea pink, orange heliconia (soft, not neon)
  const palette = ['#f4efe4', '#efd27c', '#e693b6', '#e9a06c'];
  scatter(rand, count, { camera: false }, (x, z) => sandAmount(x, z) < 0.5).forEach(([x, y, z]) => {
    composeMatrix(m, [x, y + randRange(rand, 0.06, 0.12), z], [0, rand() * Math.PI, 0], [randRange(rand, 0.025, 0.04), 0.012, randRange(rand, 0.025, 0.04)]);
    out.matrices.push(m.clone());
    out.colors.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]));
  });
  return out;
};

const Foliage = ({ quality }) => {
  const grass = useMemo(() => buildGrass(quality.grassTufts), [quality.grassTufts]);
  const bushes = useMemo(() => buildBushes(quality.bushes), [quality.bushes]);
  const flowers = useMemo(() => buildFlowers(quality.flowers), [quality.flowers]);
  const ferns = useMemo(() => buildFerns(quality.ferns), [quality.ferns]);

  const maps = useTexture({ frond: ASSETS.foliage.palmFrond, leaves: ASSETS.foliage.leafCluster });
  // Photo textures carry the color; instance tints only vary brightness and hue slightly
  const tints = useMemo(
    () => ({
      bushes: bushes.colors.map((c) => c.clone().lerp(new THREE.Color('#ffffff'), 0.75).multiplyScalar(1.2)),
      ferns: ferns.colors.map((c) => c.clone().lerp(new THREE.Color('#ffffff'), 0.75)),
      grass: grass.colors.map((c) => c.clone().multiplyScalar(0.8)),
    }),
    [bushes, ferns, grass]
  );

  const geometries = useMemo(
    () => ({
      tuft: createGrassTuft(),
      bush: createLeafClumpGeometry(10),
      flower: new THREE.IcosahedronGeometry(1, 1),
      fern: createFrondCardGeometry({ length: 0.75, width: 0.38, segments: 5, droop: 0.7 }),
    }),
    []
  );
  const materials = useMemo(
    () => ({
      bush: createLeafMaterial(maps.leaves, { amplitude: 0.03, frequency: 1.4, roundShading: true }),
      fern: createLeafMaterial(maps.frond, { amplitude: 0.08, frequency: 1.5 }),
      grass: applyWind(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), {
        amplitude: 1.4,
        frequency: 2.0,
        mode: 'height',
      }),
      flower: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    }),
    [maps]
  );

  return (
    <group>
      <InstancedSet geometry={geometries.tuft} material={materials.grass} matrices={grass.matrices} colors={tints.grass} receiveShadow />
      <InstancedSet geometry={geometries.bush} material={materials.bush} matrices={bushes.matrices} colors={tints.bushes} castShadow receiveShadow />
      <InstancedSet geometry={geometries.flower} material={materials.flower} matrices={flowers.matrices} colors={flowers.colors} />
      <InstancedSet geometry={geometries.fern} material={materials.fern} matrices={ferns.matrices} colors={tints.ferns} castShadow />
    </group>
  );
};

// Memoized: the scene re-renders when the time of day changes, but this doesn't depend on it
export default React.memo(Foliage);
