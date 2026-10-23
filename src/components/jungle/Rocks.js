import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider } from '@react-three/rapier';
import { ASSETS, ISLAND, KARSTS, KAYAK } from './sceneConfig';
import { useGLTF } from '@react-three/drei';
import { isInKarst, isInside, shoreCoordinate, terrainHeight } from './Island';
import { createRandom, randRange } from './utils/geometry';

/*
 * Rounded low-poly boulders along the beach and in the shallows, small rocks
 * clustered around the sea stacks, and faint foam lapping wherever rock
 * meets the water.
 */

/** Boulder spots: mostly on the beach, a few just offshore. */
const buildBoulders = (count) => {
  const rand = createRandom(303);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 300) {
    const x = randRange(rand, ISLAND.min + 0.8, ISLAND.max - 0.8);
    const z = randRange(rand, ISLAND.min + 0.8, ISLAND.max - 0.8);
    const s = shoreCoordinate(x, z);
    // Beach and the first shallow metre of water only (the seabed drops off past that)
    if (s < 8.2 || s > 11.4 || isInKarst(x, z, 1.6)) continue;
    if (Math.hypot(x - KAYAK.position[0], z - KAYAK.position[1]) < 2.2) continue;
    const radius = s > 12 ? randRange(rand, 0.25, 0.5) : randRange(rand, 0.3, 0.75);
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.radius + radius) * 1.6)) continue;
    out.push({ x, z, radius, seed: 400 + out.length, spin: rand() * Math.PI * 2 });
  }
  return out;
};

/** Small rocks huddled around the base of each sea stack. */
const buildStackRocks = () => {
  const rand = createRandom(505);
  const out = [];
  KARSTS.forEach((k) => {
    const [cx, cz] = k.position;
    if (terrainHeight(cx, cz) > ISLAND.waterLevel) return; // only towers standing in the sea
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = k.radius * randRange(rand, 1.0, 1.35);
      out.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, radius: randRange(rand, 0.2, 0.4), seed: 600 + out.length, spin: rand() * 6 });
    }
  });
  return out.filter((r) => isInside(r.x, r.z, 0.3));
};

/** A boulder: the scanned limestone model, squashed and partly buried. */
const Boulder = ({ x, z, radius, seed, spin, physics, rock }) => {
  const footprint = useMemo(() => {
    rock.geometry.computeBoundingBox();
    const size = rock.geometry.boundingBox.getSize(new THREE.Vector3());
    return Math.max(size.x, size.z);
  }, [rock]);
  const y = terrainHeight(x, z) - radius * 0.35;
  const horizontal = (radius * 2) / footprint;
  const mesh = (
    <mesh
      geometry={rock.geometry}
      material={rock.material}
      position={physics ? [0, -radius * 0.35, 0] : [x, y, z]}
      rotation={[seed % 2 ? Math.PI : 0, spin, 0]}
      scale={[horizontal, radius * (1.1 + (seed % 3) * 0.15), horizontal * 0.9]}
      castShadow
      receiveShadow
    />
  );
  if (!physics) return mesh;
  return (
    <RigidBody type="fixed" colliders={false} position={[x, terrainHeight(x, z), z]} userData={{ hard: true }}>
      <BallCollider args={[radius * 0.7]} />
      {mesh}
    </RigidBody>
  );
};

const foamVertexShader = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const foamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vLocal;
  void main() {
    // Soft, broken band of foam just outside the rock, fading outward
    float r = length(vLocal);
    float band = smoothstep(uInner - 0.02, uInner + 0.04, r) * (1.0 - smoothstep(uInner + 0.04, uInner + 0.28, r));
    float angle = atan(vLocal.y, vLocal.x);
    float breakup = 0.55 + 0.45 * sin(angle * 5.0 + uTime * 0.8 + r * 9.0) * sin(angle * 3.0 - uTime * 0.6);
    gl_FragColor = vec4(uColor, band * breakup * uOpacity);
  }
`;

/** Faint, broken foam that laps around rocks where they break the water's surface. */
const FoamRing = ({ x, z, radius, env }) => {
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uInner: { value: radius }, uOpacity: { value: 0.4 }, uColor: { value: new THREE.Color() } }),
    [radius]
  );
  uniforms.uColor.value.set('#ffffff').multiplyScalar(env.isNight ? 0.35 : 0.95);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={[x, ISLAND.waterLevel + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} raycast={() => null}>
      <circleGeometry args={[radius + 0.32, 32]} />
      <shaderMaterial uniforms={uniforms} vertexShader={foamVertexShader} fragmentShader={foamFragmentShader} transparent depthWrite={false} />
    </mesh>
  );
};

const Rocks = ({ quality, env }) => {
  const { scene } = useGLTF(ASSETS.rocks.boulder, ASSETS.draco);
  const rock = useMemo(() => {
    let mesh = null;
    scene.traverse((o) => {
      if (!mesh && o.isMesh) mesh = o;
    });
    return mesh;
  }, [scene]);
  const boulders = useMemo(() => buildBoulders(quality.boulders), [quality.boulders]);
  const stackRocks = useMemo(buildStackRocks, []);

  // Foam wherever rock stands in the sea: around the sea stacks and the offshore boulders
  const rings = useMemo(() => {
    const out = [];
    KARSTS.forEach((k) => {
      if (terrainHeight(...k.position) < ISLAND.waterLevel) out.push({ x: k.position[0], z: k.position[1], radius: k.radius * 1.05 });
    });
    [...boulders, ...stackRocks].forEach((b) => {
      // Only rocks standing in real water, not ones on the wet sand
      const depth = ISLAND.waterLevel - terrainHeight(b.x, b.z);
      // Only rocks that stand in water and still break its surface
      if (depth > 0.15 && depth < b.radius * 0.9) out.push({ x: b.x, z: b.z, radius: b.radius * 0.85 });
    });
    return out;
  }, [boulders, stackRocks]);

  return (
    <group>
      {boulders.map((b) => (
        <Boulder key={b.seed} {...b} rock={rock} physics />
      ))}
      {stackRocks.map((b) => (
        <Boulder key={b.seed} {...b} rock={rock} />
      ))}
      {rings.map((r, i) => (
        <FoamRing key={i} {...r} env={env} />
      ))}
    </group>
  );
};

export default React.memo(Rocks);
