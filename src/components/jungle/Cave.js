import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { ASSETS, ISLAND } from './sceneConfig';
import { ROCK_KEYS, firstMesh, placeTower } from './Karsts';
import { terrainHeight } from './Island';
import { CAVE_EXHIBITS } from '../../data/caveExhibits';
import { CAVE_TOWER as TOWER, caveSite } from './utils/caveSite';
import { NOT_OCCLUDER } from './utils/groundOcclusion';

/*
 * Sira's hidden lab, in a cave behind the main waterfall. Nothing gives it
 * away from outside: tapping the waterfall flies the camera through the
 * falling water and the rock behind it, into a domed chamber with a
 * workbench, a lantern, glowing crystals and string lights, and his projects
 * on glowing screens along the back wall (CAVE_EXHIBITS; tap one to read it).
 *
 * Everything in here is unlit: the rock's lantern and crystal glow is baked
 * into vertex colors and the lights are glowing materials, so the cave adds no
 * lights to the rest of the scene's shaders. Laid out in the waterfall's
 * frame (origin at the tower's center, +Z out of the cliff face), like the
 * waterfall ribbon itself (Karsts.js).
 */
const TURN = Math.PI / 2 - TOWER.waterfallAngle;
const RADIUS = 2.2; // chamber
const SCREEN = { width: 0.62, height: 0.4 };

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
  { at: [-1.25, floor + 1.05, chamberZ - 0.55], color: [1, 0.6, 0.3], strength: 1.6, reach: 2.2 }, // lantern on the bench
  { at: [1.45, floor + 0.45, chamberZ - 0.9], color: [0.35, 0.8, 1], strength: 1.2, reach: 1.5 }, // crystals
  { at: [-0.95, floor + 0.3, chamberZ + 1.45], color: [0.35, 0.8, 1], strength: 0.8, reach: 1.2 }, // crystals by the way in
  { at: [0, floor + 1.2, chamberZ - 1.55], color: [0.55, 0.72, 1], strength: 0.7, reach: 1.4 }, // the screens
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

/** A screen's face: title and tech on a dark glass panel. */
const screenTexture = (exhibit) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 330;
  const c = canvas.getContext('2d');
  const gradient = c.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#16324a');
  gradient.addColorStop(1, '#0b1826');
  c.fillStyle = gradient;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#7fd8ff';
  c.fillRect(36, 40, 44, 6);
  c.fillStyle = '#f2f7fb';
  c.font = '600 38px -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';
  // Title over up to two lines
  const words = exhibit.title.split(' ');
  const lines = [''];
  words.forEach((word) => {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (c.measureText(next).width > canvas.width - 72 && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = next;
  });
  lines.slice(0, 2).forEach((line, i) => c.fillText(line, 36, 108 + i * 46));
  c.fillStyle = '#9fb6c8';
  c.font = '400 23px -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';
  const tech = exhibit.tech.length > 42 ? `${exhibit.tech.slice(0, 40)}…` : exhibit.tech;
  c.fillText(tech, 36, 230);
  c.fillStyle = '#7fd8ff';
  c.font = '500 21px -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';
  c.fillText('Tap to read ›', 36, 286);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/** Screens in a gentle arc along the back wall, facing the way in; two rows if there are many. */
const screenSpots = (layout, count) => {
  const rows = count > 4 ? [Math.ceil(count / 2), Math.floor(count / 2)] : [count];
  const spots = [];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      // The dome closes in higher up: the top row stands further off the wall
      const r = RADIUS - (rows.length > 1 && row === 0 ? 0.66 : 0.5);
      // A little gap between neighbours
      const angle = (i - (n - 1) / 2) * ((SCREEN.width + 0.08) / r);
      spots.push({
        position: [Math.sin(angle) * r, layout.floor + (rows.length > 1 ? (row === 0 ? 1.42 : 0.9) : 1.15), layout.chamberZ - Math.cos(angle) * r],
        rotationY: -angle,
      });
    }
  });
  return spots;
};

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
  const textures = useMemo(() => CAVE_EXHIBITS.map(screenTexture), []);
  const spots = useMemo(() => screenSpots(layout, CAVE_EXHIBITS.length), [layout]);

  // The camera's way in (CameraRig): over the pool, through the falling water and the rock, to the screens
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
      toWorld(0, y + 1.12, chamberZ - RADIUS + 0.4),
    ];
    Object.assign(caveSite, { ready: true, path, look });
    return () => {
      caveSite.ready = false;
    };
  }, [layout]);

  useLayoutEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

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
      {/* The secret: tapping the falling water (an invisible target in front of it) */}
      <mesh position={[0, 2.6, face + 0.35]} onClick={tapWaterfall} onPointerOver={interactive ? hover(true) : undefined} onPointerOut={hover(false)}>
        <boxGeometry args={[1.7, 5.2, 0.5]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <mesh geometry={dome} raycast={() => null}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} />
      </mesh>
      <mesh geometry={floor} raycast={() => null}>
        <meshBasicMaterial vertexColors />
      </mesh>

      <Workbench position={[-1.2, y, chamberZ - 0.45]} rotationY={0.75} />
      <Crystal position={[1.45, y, chamberZ - 0.95]} scale={2.2} tilt={0.15} />
      <Crystal position={[1.7, y, chamberZ - 0.3]} scale={1.4} tilt={-0.2} />
      <Crystal position={[0.8, y, chamberZ - 1.3]} scale={1.6} tilt={-0.1} />
      <Crystal position={[-0.95, y, chamberZ + 1.45]} scale={1.6} tilt={0.25} />
      <Crystal position={[0.6, y + 2.3, chamberZ - 1.2]} scale={1.1} tilt={Math.PI} />
      <StringLights from={[-1.4, y + 2.0, chamberZ - 1.0]} to={[1.3, y + 1.95, chamberZ - 1.25]} />

      {CAVE_EXHIBITS.map((exhibit, i) => {
        const spot = spots[i];
        if (!spot) return null;
        return (
          <group key={exhibit.title} position={spot.position} rotation={[0, spot.rotationY, 0]}>
            <mesh position={[0, 0, -0.012]} raycast={() => null}>
              <boxGeometry args={[SCREEN.width + 0.05, SCREEN.height + 0.05, 0.02]} />
              <meshBasicMaterial color="#141210" />
            </mesh>
            <mesh
              onClick={(e) => {
                if (!inside || e.delta > 6) return;
                e.stopPropagation();
                onSelect(i);
              }}
              onPointerOver={inside ? hover(true) : undefined}
              onPointerOut={hover(false)}
            >
              <planeGeometry args={[SCREEN.width, SCREEN.height]} />
              <meshBasicMaterial map={textures[i]} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default React.memo(Cave);
