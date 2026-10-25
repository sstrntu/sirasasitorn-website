import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ASSETS, ISLAND } from './sceneConfig';
import { ROCK_KEYS, firstMesh, placeTower } from './Karsts';
import { terrainHeight } from './Island';
import { CAVE_ITEMS } from '../../data/caveItems';
import { CAVE_TOWER as TOWER, caveSite } from './utils/caveSite';
import { NOT_OCCLUDER } from './utils/groundOcclusion';

/*
 * Sira's hidden lab, in a cave behind the main waterfall. Nothing gives it
 * away from outside: tapping the waterfall flies the camera through the
 * falling water and the rock behind it, into a domed chamber with a
 * workbench, a lantern, glowing crystals and string lights, and his things on
 * display: each on a pedestal under a velvet cloth, with a name plate
 * (CAVE_ITEMS; tap one to read about it).
 *
 * Everything in here is unlit: the rock's lantern and crystal glow is baked
 * into vertex colors and the lights are glowing materials, so the cave adds no
 * lights to the rest of the scene's shaders. It's only drawn while the camera
 * is inside (from outside, its walls would show through the tower's rock).
 * Laid out in the waterfall's
 * frame (origin at the tower's center, +Z out of the cliff face), like the
 * waterfall ribbon itself (Karsts.js).
 */
const TURN = Math.PI / 2 - TOWER.waterfallAngle;
const RADIUS = 2.2; // chamber

/** Rock face distance (local z) at a height, from rays like the waterfall's. */
const faceAt = (probe, x, y) => {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, TOWER.radius * 4), new THREE.Vector3(0, 0, -1));
  return ray.intersectObject(probe)[0]?.point.z ?? TOWER.radius;
};

/** Local (waterfall frame) to world. */
const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), TURN).add(new THREE.Vector3(TOWER.position[0], 0, TOWER.position[1]));

/** Smooth bumpy noise for the rock (sum of sines, deterministic). */
const bumps = (x, y, z) =>
  Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7 + 0.4) * Math.sin(z * 4.6 + 2.1) * 0.6 +
  Math.sin(x * 9.3 + z * 7.1 + 0.7) * 0.25 +
  Math.sin(y * 11.7 - x * 5.2) * 0.15;

const buildLayout = (rockMesh) => {
  const placement = placeTower(TOWER, rockMesh);
  const probe = new THREE.Mesh(rockMesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  probe.position.set(0, placement.base, 0);
  probe.scale.copy(placement.scale);
  probe.updateMatrixWorld(true);
  const face = Math.max(...[0.6, 1.2, 1.8].flatMap((y) => [-0.5, 0, 0.5].map((x) => faceAt(probe, x, y))));
  const chamberZ = face - 0.3 - RADIUS;
  // Floor just above the highest ground under the chamber (the island's surface runs under the tower)
  let ground = ISLAND.streamLevel + 0.35;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    for (const r of [0, RADIUS * 0.5, RADIUS]) {
      const w = toWorld(Math.cos(a) * r, 0, chamberZ + Math.sin(a) * r);
      ground = Math.max(ground, terrainHeight(w.x, w.z));
    }
  }
  return { face, chamberZ, floor: ground + 0.05 };
};

/** Lights baked into the rock: [x, y, z] offsets from the chamber's floor center, color, strength, reach. */
const bakeLights = ({ floor, chamberZ }) => [
  { at: [-1.5, floor + 0.95, chamberZ + 0.35], color: [1, 0.6, 0.3], strength: 1.6, reach: 2.2 }, // lantern on the bench
  { at: [1.45, floor + 0.45, chamberZ - 0.9], color: [0.35, 0.8, 1], strength: 1.2, reach: 1.5 }, // crystals
  { at: [-0.95, floor + 0.3, chamberZ + 1.45], color: [0.35, 0.8, 1], strength: 0.8, reach: 1.2 }, // crystals by the way in
  { at: [0, floor + 1.0, chamberZ - 1.3], color: [0.9, 0.78, 0.6], strength: 0.6, reach: 1.6 }, // over the things on display
  { at: [0, floor + 2.3, chamberZ], color: [1, 0.75, 0.45], strength: 0.35, reach: 1.8 }, // string lights
];

/** Vertex colors for rock (or floor) geometry: stone lit by the baked lights. `inward`: its normals point out of the room. */
const paint = (geometry, lights, base, ambient, inward = false) => {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    // Stone grain and darker cracks
    const grain = (1 + bumps(p.x * 2.3, p.y * 2.3, p.z * 2.3) * 0.14) * (0.82 + 0.18 * Math.abs(Math.sin(p.x * 17.1 + p.y * 13.3 + p.z * 11.7)));
    let r = ambient;
    let g = ambient;
    let b = ambient * 1.1;
    lights.forEach((l) => {
      d.set(l.at[0] - p.x, l.at[1] - p.y, l.at[2] - p.z);
      const dist = d.length();
      // Surfaces turned toward the light catch more of it
      const facing = 0.45 + 0.55 * Math.max(0, (inward ? -1 : 1) * n.dot(d.normalize()));
      const fall = Math.max(0, 1 - dist / l.reach) ** 2 * l.strength * facing;
      r += l.color[0] * fall;
      g += l.color[1] * fall;
      b += l.color[2] * fall;
    });
    colors[i * 3] = base[0] * r * grain;
    colors[i * 3 + 1] = base[1] * g * grain;
    colors[i * 3 + 2] = base[2] * b * grain;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

/** The chamber's dome: a bumpy, slightly tall half sphere, its bottom below the floor. */
const buildDome = (layout, lights) => {
  const geometry = new THREE.SphereGeometry(1, 48, 26, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + bumps(v.x, v.y, v.z) * 0.11 + bumps(v.x * 3.1, v.y * 3.1, v.z * 3.1) * 0.035;
    pos.setXYZ(i, v.x * RADIUS * k, layout.floor + 0.35 + v.y * RADIUS * 1.15 * k, layout.chamberZ + v.z * RADIUS * k);
  }
  geometry.computeVertexNormals();
  paint(geometry, lights, [0.2, 0.17, 0.15], 0.1, true);
  // Bulges catch the light, hollows stay dark
  const color = geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(new THREE.Vector3(0, layout.floor + 0.35, layout.chamberZ));
    const shade = THREE.MathUtils.clamp(1 + (RADIUS - v.length()) * 2.2, 0.55, 1.35);
    color.setXYZ(i, color.getX(i) * shade, color.getY(i) * shade, color.getZ(i) * shade);
  }
  return geometry;
};

const buildFloor = (layout, lights) => {
  const geometry = new THREE.CircleGeometry(RADIUS * 1.06, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2);
  geometry.translate(0, layout.floor, layout.chamberZ);
  return paint(geometry, lights, [0.24, 0.2, 0.16], 0.14);
};

/** A name plate: the item's name in brass on dark wood. */
const plateTexture = (name) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.fillStyle = '#2b2016';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#b8955a';
  c.lineWidth = 4;
  c.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  c.fillStyle = '#e2c27f';
  c.font = '600 40px -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(name, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/** A box with flat-shaded faces (lit top, shaded sides), unlit like the rest of the cave. Colors are linear RGB. */
const shadedBox = (width, height, depth, { top, front, side, back }) => {
  const geometry = new THREE.BoxGeometry(width, height, depth).toNonIndexed();
  // BoxGeometry's faces come in the order +x, -x, +y, -y, +z, -z: six vertices each
  const faces = [side, side, top, back, front, back];
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  faces.forEach((color, face) => {
    for (let v = 0; v < 6; v++) colors.set(color, (face * 6 + v) * 3);
  });
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const PEDESTAL = { width: 0.32, height: 0.62 };

/** A velvet cloth draped over the item: a soft bell with folds, lighter on top and in front. */
const buildCloth = () => {
  const profile = [[0, 0.29], [0.05, 0.285], [0.095, 0.262], [0.125, 0.215], [0.14, 0.15], [0.147, 0.08], [0.158, 0.025], [0.172, 0.004], [0.18, 0]];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const velvet = [0.15, 0.025, 0.04];
  for (let i = 0; i < pos.count; i++) {
    const folds = 0.82 + 0.18 * Math.sin(Math.atan2(pos.getX(i), pos.getZ(i)) * 7 + pos.getY(i) * 6);
    const light = (0.5 + 0.5 * Math.max(0, nor.getY(i)) + 0.35 * Math.max(0, nor.getZ(i))) * folds * 1.25;
    colors.set([velvet[0] * light, velvet[1] * light, velvet[2] * light], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

/** Pedestals in an arc around the back of the chamber, each turned to face the way in. */
const itemSpots = (layout, count) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i - (count - 1) / 2) * 0.32;
    const r = 1.55;
    return { position: [Math.sin(angle) * r, layout.floor, layout.chamberZ - Math.cos(angle) * r], rotationY: -angle };
  });

/** One item on display: pedestal, the covered item, its name plate. Tapping it opens its card. */
const DisplayItem = ({ spot, plate, pedestal, cloth, onTap, onHover }) => (
  <group position={spot.position} rotation={[0, spot.rotationY, 0]}>
    <group onClick={onTap} onPointerOver={onHover(true)} onPointerOut={onHover(false)}>
      <mesh geometry={pedestal} position={[0, PEDESTAL.height / 2, 0]}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <mesh geometry={cloth} position={[0, PEDESTAL.height, 0]} scale={1.15}>
        <meshBasicMaterial vertexColors />
      </mesh>
    </group>
    <mesh position={[0, PEDESTAL.height * 0.78, PEDESTAL.width / 2 + 0.002]} raycast={() => null}>
      <planeGeometry args={[0.24, 0.09]} />
      <meshBasicMaterial map={plate} toneMapped={false} />
    </mesh>
  </group>
);

const Crystal = ({ position, scale = 1, tilt = 0 }) => (
  <group position={position} rotation={[tilt, 0, tilt * 0.6]} scale={scale}>
    {[[0, 0, 0, 1], [0.06, -0.02, 0.04, 0.7], [-0.05, -0.03, -0.02, 0.6], [0.02, -0.03, -0.06, 0.5]].map(([x, y, z, s], i) => (
      <mesh key={i} position={[x, y + 0.09 * s, z]} rotation={[i * 0.3, i, i * 0.2]} scale={[0.035 * s, 0.11 * s, 0.035 * s]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={i === 0 ? '#a8ecff' : '#73cdf2'} />
      </mesh>
    ))}
  </group>
);

/** Workbench with a laptop, papers, a mug and the lantern. */
const Workbench = ({ position, rotationY }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.74, 0]}>
      <boxGeometry args={[1.05, 0.05, 0.5]} />
      <meshBasicMaterial color="#6b4a31" />
    </mesh>
    {[-0.45, 0.45].map((x) => (
      <mesh key={x} position={[x, 0.36, 0]}>
        <boxGeometry args={[0.06, 0.72, 0.42]} />
        <meshBasicMaterial color="#4a3222" />
      </mesh>
    ))}
    {/* Laptop, its screen glowing */}
    <mesh position={[0.12, 0.775, 0.02]}>
      <boxGeometry args={[0.32, 0.016, 0.22]} />
      <meshBasicMaterial color="#8d9196" />
    </mesh>
    <mesh position={[0.12, 0.88, -0.09]} rotation={[-0.25, 0, 0]}>
      <boxGeometry args={[0.32, 0.21, 0.01]} />
      <meshBasicMaterial color="#9fd7ff" />
    </mesh>
    {/* Papers and a mug */}
    <mesh position={[-0.25, 0.768, 0.06]} rotation={[0, 0.3, 0]}>
      <boxGeometry args={[0.21, 0.004, 0.28]} />
      <meshBasicMaterial color="#d8d2c4" />
    </mesh>
    <mesh position={[-0.05, 0.8, 0.15]}>
      <cylinderGeometry args={[0.035, 0.032, 0.08, 12]} />
      <meshBasicMaterial color="#3c6e8f" />
    </mesh>
    {/* Lantern */}
    <group position={[-0.4, 0.77, -0.1]}>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.13, 12]} />
        <meshBasicMaterial color="#ffd08a" />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.035, 0.055, 0.03, 12]} />
        <meshBasicMaterial color="#2a2522" />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshBasicMaterial color="#ffb45c" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  </group>
);

// Brighter than white, so they glow (bloom) on desktop
const BULB_A = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.2) });
const BULB_B = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc070').multiplyScalar(2.2) });

/** Warm string lights sagging across the dome. */
const StringLights = ({ from, to, count = 11 }) => {
  const points = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      return a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.35, 0));
    });
  }, [from, to, count]);
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p} material={i % 2 ? BULB_A : BULB_B}>
          <sphereGeometry args={[0.018, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
};

const Cave = ({ interactive, inside, onEnter, onSelect }) => {
  const gltfs = useGLTF(ROCK_KEYS.map((key) => ASSETS.rocks[key]), ASSETS.draco);
  const layout = useMemo(() => buildLayout(firstMesh(gltfs[ROCK_KEYS.indexOf(TOWER.model)])), [gltfs]);
  const lights = useMemo(() => bakeLights(layout), [layout]);
  const dome = useMemo(() => buildDome(layout, lights), [layout, lights]);
  const floor = useMemo(() => buildFloor(layout, lights), [layout, lights]);
  const plates = useMemo(() => CAVE_ITEMS.map((item) => plateTexture(item.name)), []);
  const spots = useMemo(() => itemSpots(layout, CAVE_ITEMS.length), [layout]);
  const pedestal = useMemo(
    // Dark wood plinths
    () => shadedBox(PEDESTAL.width, PEDESTAL.height, PEDESTAL.width, { top: [0.13, 0.095, 0.07], front: [0.085, 0.06, 0.045], side: [0.05, 0.036, 0.027], back: [0.03, 0.022, 0.017] }),
    []
  );
  const cloth = useMemo(buildCloth, []);
  // Drawn only while the camera is in here (and once at load, so its shaders compile with the rest)
  const visuals = useRef();
  useFrame(() => {
    if (visuals.current) visuals.current.visible = caveSite.inside;
  });

  // The camera's way in (CameraRig): over the pool, through the falling water and the rock, to the display
  useLayoutEffect(() => {
    const { face, chamberZ, floor: y } = layout;
    const pool = TOWER.radius + 1.1;
    const path = [
      toWorld(0.8, y + 2.6, pool + 4.6),
      toWorld(0, y + 1.45, face + 1.4),
      toWorld(0, y + 1.38, face + 0.05),
      toWorld(0, y + 1.32, chamberZ + RADIUS - 0.45),
    ];
    const look = [
      toWorld(0, y + 1.2, face),
      toWorld(0, y + 1.3, face - 1),
      toWorld(0, y + 1.25, chamberZ),
      toWorld(0, y + 0.8, chamberZ - 1.4),
    ];
    Object.assign(caveSite, { ready: true, path, look });
    return () => {
      caveSite.ready = false;
    };
  }, [layout]);

  useLayoutEffect(() => () => plates.forEach((t) => t.dispose()), [plates]);

  const tapWaterfall = (e) => {
    if (!interactive || e.delta > 6) return;
    e.stopPropagation();
    onEnter();
  };
  const hover = (on) => () => {
    document.body.style.cursor = on ? 'pointer' : '';
  };
  const { face, chamberZ, floor: y } = layout;

  return (
    <group position={[TOWER.position[0], 0, TOWER.position[1]]} rotation={[0, TURN, 0]} userData={NOT_OCCLUDER}>
      {/* The secret: tapping the falling water (a generous invisible target over all of it) */}
      <mesh position={[0, 5.5, face + 0.6]} onClick={tapWaterfall} onPointerOver={interactive ? hover(true) : undefined} onPointerOut={hover(false)}>
        <boxGeometry args={[2.6, 11, 1]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={visuals}>
        <mesh geometry={dome} raycast={() => null}>
          <meshBasicMaterial vertexColors side={THREE.BackSide} />
        </mesh>
        <mesh geometry={floor} raycast={() => null}>
          <meshBasicMaterial vertexColors />
        </mesh>

        <Workbench position={[-1.55, y, chamberZ + 0.45]} rotationY={1.85} />
        <Crystal position={[1.6, y, chamberZ - 0.9]} scale={2.2} tilt={0.15} />
        <Crystal position={[1.85, y, chamberZ - 0.2]} scale={1.4} tilt={-0.2} />
        <Crystal position={[0, y, chamberZ - 1.95]} scale={1.5} tilt={-0.1} />
        <Crystal position={[-0.95, y, chamberZ + 1.45]} scale={1.6} tilt={0.25} />
        <Crystal position={[0.6, y + 2.3, chamberZ - 1.2]} scale={1.1} tilt={Math.PI} />
        <StringLights from={[-1.4, y + 2.0, chamberZ - 1.0]} to={[1.3, y + 1.95, chamberZ - 1.25]} />

        {CAVE_ITEMS.map((item, i) => (
          <DisplayItem
            key={item.id}
            spot={spots[i]}
            plate={plates[i]}
            pedestal={pedestal}
            cloth={cloth}
            onHover={(on) => (inside ? hover(on) : undefined)}
            onTap={(e) => {
              if (!inside || e.delta > 6) return;
              e.stopPropagation();
              onSelect(i);
            }}
          />
        ))}
      </group>
    </group>
  );
};

export default React.memo(Cave);
