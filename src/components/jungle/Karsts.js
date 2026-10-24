import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler';
import { ASSETS, COLORS, ISLAND, KARSTS } from './sceneConfig';
import { WaterfallRibbon } from './Waterfall';
import { isInWaterfallPath, terrainHeight } from './Island';
import { composeMatrix, createRandom, randRange } from './utils/geometry';
import { createLeafClumpGeometry, createLeafMaterial } from './utils/foliageCards';
import { softenScan } from './utils/softenScan';
import { CAVE_TOWER, caveSite } from './utils/caveSite';

/*
 * Limestone karst towers, Krabi style (think Railay or Phi Phi).
 *
 * The rock is a realistic scanned-style model (Higgsfield image-to-3D, see
 * ASSETS.rocks), placed and scaled per tower from KARSTS. Vegetation is added
 * here rather than baked into the model: leafy clumps are scattered over the
 * tower's top and ledges by sampling the rock's surface. Towers with a
 * `waterfallAngle` carry a waterfall fitted to the rock face by raycasting.
 */

/** Lowest ground under a tower's footprint, so its base is buried. */
const baseHeight = ({ position: [cx, cz], radius }) => {
  let lowest = Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    for (const r of [0, radius * 0.6, radius * 1.3]) {
      lowest = Math.min(lowest, terrainHeight(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
  }
  return lowest - 0.3;
};

/** First mesh of a loaded glTF scene. */
export const firstMesh = (gltf) => {
  let mesh = null;
  gltf.scene.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o;
  });
  return mesh;
};

/** Placement of one tower: world transform for its rock mesh. */
export const placeTower = (k, rockMesh) => {
  const base = baseHeight(k);
  const geometry = rockMesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  // Models are normalized to height 1; stretch the footprint to the tower's radius
  const footprint = Math.max(size.x, size.z);
  const horizontal = (k.radius * 2) / footprint;
  const scale = new THREE.Vector3(horizontal, k.height - base, horizontal);
  // Waterfall towers turn their front (+Z) toward the waterfall direction
  const rotationY = k.waterfallAngle !== undefined ? Math.PI / 2 - k.waterfallAngle : k.turn ?? 0;
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(k.position[0], base, k.position[1]),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    scale
  );
  return { base, scale, rotationY, matrix };
};

/**
 * Waterfall path down the tower's front, in the tower's local frame (rotated
 * so +Z points out of the face). Rays from outside find the rock surface at
 * each height; the water keeps clear of any bulge below the lip.
 */
const buildWaterfallPath = (k, rockMesh, { base, scale }) => {
  const probe = new THREE.Mesh(rockMesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  probe.position.set(0, base, 0);
  probe.scale.copy(scale);
  probe.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  // Start at the summit: the first ray that hits the rock marks the lip
  const top = base + (k.height - base) * 0.99;
  const points = [];
  let reach = 0;
  for (let y = top; y >= ISLAND.streamLevel; y -= 0.25) {
    raycaster.set(new THREE.Vector3(0, y, k.radius * 4), new THREE.Vector3(0, 0, -1));
    const hit = raycaster.intersectObject(probe)[0];
    if (hit) reach = Math.max(reach, hit.point.z + 0.15);
    if (reach > 0) points.push(new THREE.Vector3(0, y, reach));
  }
  points.push(new THREE.Vector3(0, ISLAND.streamLevel, reach));
  return points;
};

/** Leafy clumps over each tower's top and ledges, sampled from the rock's surface. */
const buildGreenery = (towers) => {
  const rand = createRandom(77);
  const matrices = [];
  const colors = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const palette = [COLORS.jungle, COLORS.jungleLight, COLORS.leaf, '#ffffff'];
  towers.forEach(({ k, rockMesh, placement }) => {
    const sampleMesh = new THREE.Mesh(rockMesh.geometry.clone().applyMatrix4(placement.matrix));
    const sampler = new MeshSurfaceSampler(sampleMesh).build();
    const target = Math.round(k.radius * k.radius * 30);
    const clumpScale = Math.min(1, k.radius / 2.4);
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < target * 60) {
      sampler.sample(p, n);
      const t = (p.y - placement.base) / (k.height - placement.base);
      // Thick on the top and flat ledges, sparse tufts on steep faces
      const ledge = n.y > 0.55;
      if (!ledge && !(n.y > -0.1 && rand() < 0.02)) continue;
      if (t < 0.12 && !ledge) continue;
      // Keep the waterfall's face and drop clear
      if (isInWaterfallPath(p.x, p.z, 0.6)) continue;
      const s = (ledge ? randRange(rand, 0.3, 0.6) : randRange(rand, 0.18, 0.32)) * clumpScale * (t > 0.85 ? 1.2 : 1);
      composeMatrix(m, [p.x + n.x * s * 0.5, p.y + s * 0.45, p.z + n.z * s * 0.5], [randRange(rand, -0.4, 0.4), rand() * Math.PI * 2, randRange(rand, -0.4, 0.4)], [s, s * 0.85, s]);
      matrices.push(m.clone());
      colors.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]).lerp(new THREE.Color('#ffffff'), 0.6).multiplyScalar(randRange(rand, 1.05, 1.3)));
      placed++;
    }
  });
  return { matrices, colors };
};

/** Churning white water where a waterfall lands. */
const FallFoam = ({ position, size }) => {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.children.forEach((m, i) => {
      m.position.y = Math.abs(Math.sin(t * 5 + i * 1.9)) * 0.08 * size;
      m.scale.set(1, 0.5, 1).multiplyScalar((0.12 + Math.abs(Math.sin(t * 3.1 + i)) * 0.06) * size);
    });
  });
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.05) * 0.4 * size, 0, Math.sin(i * 1.05) * 0.25 * size]} raycast={() => null}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial color="#f4fbfc" roughness={0.6} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

// The boulder model is used by Rocks.js / CampProps.js, not as a tower
export const ROCK_KEYS = Object.keys(ASSETS.rocks).filter((key) => key !== 'boulder');

const Karsts = ({ env }) => {
  const gltfs = useGLTF(ROCK_KEYS.map((key) => ASSETS.rocks[key]), ASSETS.draco);
  const leafMap = useTexture(ASSETS.foliage.leafCluster);

  const towers = useMemo(() => {
    const meshes = Object.fromEntries(ROCK_KEYS.map((key, i) => [key, firstMesh(gltfs[i])]));
    // Matte, softer rock that sits with the painted lawn (the scans' fine cracks read as grain)
    Object.values(meshes).forEach((mesh) => softenScan(mesh.material));
    return KARSTS.map((k) => {
      const rockMesh = meshes[k.model];
      return { k, rockMesh, placement: placeTower(k, rockMesh) };
    });
  }, [gltfs]);

  const greenery = useMemo(() => buildGreenery(towers), [towers]);
  const greeneryRef = useRef();
  // Hidden while the camera is in the cave behind its waterfall (Cave.js)
  const caveTower = useRef();
  useFrame(() => {
    if (caveTower.current) caveTower.current.visible = !caveSite.inside;
    // Its leaf clumps too: some sit on rock that passes through the cave
    if (greeneryRef.current) greeneryRef.current.visible = !caveSite.inside;
  });
  const clumpGeometry = useMemo(() => createLeafClumpGeometry(10), []);
  const leafMaterial = useMemo(() => createLeafMaterial(leafMap, { amplitude: 0.02, frequency: 0.9, roundShading: true }), [leafMap]);

  const falls = useMemo(
    () =>
      towers
        .filter(({ k }) => k.waterfallAngle !== undefined)
        .map(({ k, rockMesh, placement }) => ({
          k,
          path: buildWaterfallPath(k, rockMesh, placement),
          width: k.radius > 3 ? 1.5 : 0.9,
        })),
    [towers]
  );

  useLayoutEffect(() => {
    const mesh = greeneryRef.current;
    greenery.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, greenery.colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [greenery]);

  return (
    <group>
      {towers.map(({ k, rockMesh, placement }) => (
        <mesh
          key={k.seed}
          ref={k === CAVE_TOWER ? caveTower : undefined}
          geometry={rockMesh.geometry}
          material={rockMesh.material}
          position={[k.position[0], placement.base, k.position[1]]}
          rotation={[0, placement.rotationY, 0]}
          scale={placement.scale}
          castShadow
          receiveShadow
          raycast={() => null}
        />
      ))}
      <instancedMesh
        ref={greeneryRef}
        args={[clumpGeometry, leafMaterial, greenery.matrices.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={() => null}
      />

      {falls.map(({ k, path, width }) => (
        // Rotate so the ribbon's local +Z points out of the cliff face
        <group key={k.seed} position={[k.position[0], 0, k.position[1]]} rotation={[0, Math.PI / 2 - k.waterfallAngle, 0]}>
          <WaterfallRibbon path={path} width={width} env={env} />
          <FallFoam position={path[path.length - 1]} size={width} />
        </group>
      ))}
    </group>
  );
};

// Preload with the same keys the components use: useGLTF caches by its argument,
// so preloading the towers one by one and then loading them as an array would
// download every tower model twice
useGLTF.preload(ROCK_KEYS.map((key) => ASSETS.rocks[key]), ASSETS.draco);
useGLTF.preload(ASSETS.rocks.boulder, ASSETS.draco);

export default React.memo(Karsts);
