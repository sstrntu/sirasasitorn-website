import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { COLORS, LAYOUT } from './sceneConfig';
import { createRandom, createRockGeometry } from './utils/geometry';

const STONE_COUNT = 11;
const RING_RADIUS = 0.42;
const EMBER_COUNT = 40;
const SMOKE_COUNT = 7;

const flameVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Cylindrical billboard: face the camera around the Y axis only
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
    vec4 mv = center + vec4(position.x * scale.x, position.y * scale.y, 0.0, 0.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const flameFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 1.6 + uSeed * 10.0;
    // Turbulence scrolls upward and distorts the flame silhouette
    float n = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 2.5 - t));
    float width = (1.0 - uv.y) * 0.42 + 0.04;
    float dx = abs(uv.x - 0.5 + (n - 0.5) * 0.35 * uv.y);
    float body = smoothstep(width, width * 0.25, dx);
    float height = smoothstep(1.0, 0.25, uv.y + (n - 0.5) * 0.45);
    float shape = body * height * smoothstep(0.0, 0.08, uv.y);
    if (shape < 0.01) discard;

    // White-yellow core -> orange -> deep red tips
    vec3 core = vec3(1.6, 1.35, 0.8);
    vec3 mid = vec3(1.5, 0.55, 0.12);
    vec3 tip = vec3(0.7, 0.12, 0.03);
    float heat = shape * (1.2 - uv.y);
    vec3 col = mix(tip, mid, smoothstep(0.1, 0.5, heat));
    col = mix(col, core, smoothstep(0.55, 0.95, heat));
    gl_FragColor = vec4(col * 2.2, shape);
  }
`;

const Flames = () => {
  const materials = useRef([]);
  const flames = useMemo(
    () => [
      { position: [0, 0.27, 0], scale: [0.42, 0.7, 1], seed: 0.1 },
      { position: [0.05, 0.22, 0.04], scale: [0.3, 0.52, 1], seed: 0.47 },
      { position: [-0.06, 0.2, -0.03], scale: [0.28, 0.46, 1], seed: 0.83 },
      { position: [0.02, 0.17, -0.06], scale: [0.22, 0.34, 1], seed: 0.29 },
    ],
    []
  );
  useFrame(({ clock }) => {
    materials.current.forEach((m) => {
      if (m) m.uniforms.uTime.value = clock.elapsedTime;
    });
  });
  return flames.map((f, i) => (
    <mesh key={i} position={f.position} scale={f.scale} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={(m) => (materials.current[i] = m)}
        uniforms={{ uTime: { value: 0 }, uSeed: { value: f.seed } }}
        vertexShader={flameVertexShader}
        fragmentShader={flameFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  ));
};

/** Glowing embers drifting up from the fire (simple CPU particles). */
const Embers = () => {
  const meshRef = useRef();
  const particles = useMemo(() => {
    const rand = createRandom(11);
    return Array.from({ length: EMBER_COUNT }, () => ({
      age: rand() * 3,
      life: 1.8 + rand() * 1.8,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      speed: 0.35 + rand() * 0.5,
      seed: rand() * 100,
    }));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      p.age += delta;
      if (p.age > p.life) {
        p.age = 0;
        p.x = (Math.random() - 0.5) * 0.25;
        p.z = (Math.random() - 0.5) * 0.25;
        p.y = 0.15;
        p.vx = (Math.random() - 0.5) * 0.12;
        p.vz = (Math.random() - 0.5) * 0.12;
      }
      p.y += p.speed * delta;
      p.x += (p.vx + Math.sin(t * 2 + p.seed) * 0.08) * delta;
      p.z += (p.vz + Math.cos(t * 1.7 + p.seed) * 0.08) * delta;
      const fade = 1 - p.age / p.life;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.006 * fade + 0.001);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, EMBER_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color={[4, 1.4, 0.3]} toneMapped={false} />
    </instancedMesh>
  );
};

const createSmokeTexture = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

/** Soft smoke puffs that rise, expand and fade. */
const Smoke = ({ brightness }) => {
  const texture = useMemo(createSmokeTexture, []);
  const sprites = useRef([]);
  const puffs = useMemo(() => Array.from({ length: SMOKE_COUNT }, (_, i) => ({ offset: i / SMOKE_COUNT })), []);
  const LIFE = 6;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const age = ((t / LIFE + p.offset) % 1 + 1) % 1;
      sprite.position.set(Math.sin(t * 0.4 + i) * 0.15 + age * 0.5, 0.55 + age * 2.6, Math.cos(t * 0.3 + i) * 0.1);
      sprite.scale.setScalar(0.35 + age * 1.4);
      sprite.material.opacity = Math.sin(age * Math.PI) * 0.22;
      sprite.material.rotation = t * 0.1 + i;
    });
  });

  return puffs.map((_, i) => (
    <sprite key={i} ref={(s) => (sprites.current[i] = s)}>
      <spriteMaterial map={texture} color={new THREE.Color('#8b8d94').multiplyScalar(brightness)} transparent depthWrite={false} opacity={0} />
    </sprite>
  ));
};

/** Stylized firewood: chunky low-poly logs leaning into a loose pyramid. */
const Logs = () => {
  const logs = useMemo(() => {
    const rand = createRandom(5);
    return Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rand() * 0.4;
      return {
        position: [Math.cos(a) * 0.11, 0.1, Math.sin(a) * 0.11],
        // Lie along the radius, tipped up ~35° toward the middle
        rotation: [0, -a, Math.PI / 2 - 0.6 - rand() * 0.15],
      };
    });
  }, []);

  return (
    <group>
      {logs.map((log, i) => (
        <group key={i} position={log.position} rotation={log.rotation}>
          <mesh castShadow>
            <cylinderGeometry args={[0.032, 0.036, 0.34, 7]} />
            <meshStandardMaterial color={COLORS.bark} roughness={0.9} flatShading emissive="#ff4a10" emissiveIntensity={0.05} />
          </mesh>
          {/* Lighter cut ends */}
          <mesh position={[0, -0.171, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.036, 7]} />
            <meshStandardMaterial color="#c79a62" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Glowing coal bed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.17, 24]} />
        <meshStandardMaterial color="#120a07" emissive="#ff4410" emissiveIntensity={0.55} roughness={1} />
      </mesh>
    </group>
  );
};

/** Ring of faceted low-poly stones. */
const Stones = () => {
  const stones = useMemo(() => {
    const rand = createRandom(7);
    return Array.from({ length: STONE_COUNT }, (_, i) => {
      const a = (i / STONE_COUNT) * Math.PI * 2 + rand() * 0.2;
      const r = RING_RADIUS + (rand() - 0.5) * 0.05;
      return {
        geometry: createRockGeometry(i + 3, 0.085 + rand() * 0.03, 1),
        color: new THREE.Color(rand() < 0.5 ? COLORS.rock : COLORS.rockDark).multiplyScalar(0.9 + rand() * 0.2),
        position: [Math.cos(a) * r, 0.03, Math.sin(a) * r],
        rotation: [0, rand() * Math.PI * 2, 0],
      };
    });
  }, []);
  return stones.map((s, i) => (
    <mesh key={i} geometry={s.geometry} position={s.position} rotation={s.rotation} castShadow receiveShadow>
      <meshStandardMaterial color={s.color} roughness={0.95} flatShading />
    </mesh>
  ));
};

/** Point light whose intensity and position flicker like a real fire. */
const FireLight = ({ castShadow }) => {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flicker =
      Math.sin(t * 10.3) * 0.12 + Math.sin(t * 23.1 + 1.3) * 0.08 + Math.sin(t * 4.7 + 0.5) * 0.15 + (Math.random() - 0.5) * 0.08;
    const light = lightRef.current;
    light.intensity = 4.2 * (1 + flicker);
    light.position.set(Math.sin(t * 3.1) * 0.03, 0.5 + Math.sin(t * 5.3) * 0.03, Math.cos(t * 2.7) * 0.03);
  });
  return (
    <pointLight
      ref={lightRef}
      color={COLORS.fire}
      intensity={4.2}
      decay={2}
      distance={14}
      castShadow={castShadow}
      shadow-mapSize-width={512}
      shadow-mapSize-height={512}
      shadow-bias={-0.002}
      shadow-camera-near={0.1}
      shadow-camera-far={10}
    />
  );
};

const Campfire = ({ quality, ambient = 1 }) => (
  <group position={LAYOUT.campfire.position}>
    {/* Props bounce off the stone ring */}
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[0.06, RING_RADIUS + 0.08]} position={[0, 0.06, 0]} />
    </RigidBody>
    <Stones />
    <Logs />
    <Flames />
    <Embers />
    {/* Smoke is unlit, so dim it with the ambient light level (dark at night) */}
    <Smoke brightness={THREE.MathUtils.clamp(ambient, 0.12, 1)} />
    <FireLight castShadow={quality.fireShadows} />
  </group>
);

export default Campfire;
