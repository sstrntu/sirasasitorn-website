import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { COLORS, LAYOUT } from './sceneConfig';
import { createRandom, createRockGeometry } from './utils/geometry';
import { discover, fire, held, notify, stirFire } from './utils/play';
import { NOT_OCCLUDER } from './utils/groundOcclusion';
import { weatherNow } from './utils/krabiWeather';

const STONE_COUNT = 11;
const RING_RADIUS = 0.42;
const EMBER_COUNT = 40;
const SMOKE_COUNT = 7;
/**
 * Flames bend with whatever moves through them (a spring that's shoved by
 * fire.push and swings back upright), and get turbulent while disturbed.
 */
const LEAN_STIFFNESS = 38;
const LEAN_DAMPING = 7;
const LEAN_PER_PUSH = 9; // lean velocity per meter of shove
const MAX_LEAN = 0.32; // meters at the flame tips
const STIR_PER_PUSH = 2.2;
const STIR_DECAY = 2.2;
/** A tap on the fire is a swipe through it at this speed (m/s), in a random direction. */
const TAP_SWIPE = 1.1;
/** Fastest a pointer sweeping through the flames counts as moving (m/s). */
const MAX_HAND_SPEED = 8;
/** Pointer moves further apart than this (seconds) start a new sweep. */
const HAND_GAP = 0.15;
/** Height (local) of the plane pointer sweeps are measured on: mid-flame. */
const HAND_PLANE_Y = 0.3;
/**
 * Fuel burn rate (per second) = BURN_BASE + BURN_PER_FUEL * fuel: a full fire
 * burns down to embers in about two minutes. Embers then smolder until doused.
 */
const BURN_BASE = 0.0035;
const BURN_PER_FUEL = 0.006;
const EMBER_FUEL = 0.08;
/** Fuel added per tap (up to a full fire). */
const TAP_FUEL = 0.3;
/** A freshly struck fire grows from a small flame to this over a few seconds. */
const KINDLED_FUEL = 0.75;
const KINDLE_RATE = 0.12;
/** Tinder heat lost per second between flint strikes. */
const TINDER_COOL = 0.18;
/** Fuel the rain puts out per second in the heaviest rain (a full fire dies in about a minute and a half). */
const RAIN_DOUSE = 0.011;

/** 0 (embers or cold) to 1 (full flames) for a fuel level. */
const flameLevel = (fuel) => THREE.MathUtils.smoothstep(fuel, 0.12, 0.55);
/** 0 (cold ash) to 1 (glowing coals). */
const glowLevel = (fuel) => THREE.MathUtils.smoothstep(fuel, 0, 0.06);

const flameVertexShader = /* glsl */ `
  uniform vec3 uLean;
  uniform float uStir;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Cylindrical billboard: face the camera around the Y axis only
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
    vec4 mv = center + vec4(position.x * scale.x, position.y * scale.y, 0.0, 0.0);
    // Bend: the base stays put, the tips swing with the lean (world space,
    // turned into view space) plus a whip while the fire is stirred
    float h = uv.y * uv.y;
    vec3 lean = (viewMatrix * vec4(uLean, 0.0)).xyz;
    float whip = sin(uTime * 14.0 + uSeed * 20.0 + uv.y * 5.0) * uStir * 0.05;
    mv.xyz += (lean + vec3(whip, 0.0, 0.0)) * h;
    gl_Position = projectionMatrix * mv;
  }
`;

const flameFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStir;
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
    // Stirring tears the flame into ragged, flickering tongues
    float dx = abs(uv.x - 0.5 + (n - 0.5) * (0.35 + uStir * 0.45) * uv.y);
    float body = smoothstep(width, width * 0.25, dx);
    float height = smoothstep(1.0, 0.25, uv.y + (n - 0.5) * (0.45 + uStir * 0.5));
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

const Flames = ({ lean, stir, level }) => {
  const meshes = useRef([]);
  const flames = useMemo(
    () => [
      { position: [0, 0.27, 0], scale: [0.42, 0.7, 1], seed: 0.1 },
      { position: [0.05, 0.22, 0.04], scale: [0.3, 0.52, 1], seed: 0.47 },
      { position: [-0.06, 0.2, -0.03], scale: [0.28, 0.46, 1], seed: 0.83 },
      { position: [0.02, 0.17, -0.06], scale: [0.22, 0.34, 1], seed: 0.29 },
    ],
    []
  );
  // Stable uniform objects (one set per flame) so re-renders don't reset them
  const uniforms = useMemo(
    () =>
      flames.map((f) => ({
        uTime: { value: 0 },
        uSeed: { value: f.seed },
        uLean: { value: new THREE.Vector3() },
        uStir: { value: 0 },
      })),
    [flames]
  );
  useFrame(({ clock }) => {
    const l = level.current;
    uniforms.forEach((u, i) => {
      u.uTime.value = clock.elapsedTime;
      // Smaller flames are lighter and swing a little further
      u.uLean.value.set(lean.current.x, 0, lean.current.z).multiplyScalar(1 + i * 0.12);
      u.uStir.value = Math.min(1.2, stir.current);
    });
    // A dying fire shrinks down into the logs
    meshes.current.forEach((mesh, i) => {
      if (!mesh) return;
      const f = flames[i];
      mesh.visible = l > 0.01;
      mesh.scale.set(f.scale[0] * (0.4 + 0.6 * l), Math.max(1e-3, f.scale[1] * l), 1);
      mesh.position.y = f.position[1] + (f.scale[1] * (l - 1)) / 2;
    });
  });
  return flames.map((f, i) => (
    <mesh
      key={i}
      ref={(m) => (meshes.current[i] = m)}
      position={f.position}
      scale={f.scale}
      renderOrder={2}
      frustumCulled={false}
    >
      {/* Extra rows along the height so the flame can bend, not just shear */}
      <planeGeometry args={[1, 1, 1, 8]} />
      <shaderMaterial
        uniforms={uniforms[i]}
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
const Embers = ({ burst, level, lean }) => {
  const meshRef = useRef();
  const seenBurst = useRef(0);
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
      baseSpeed: 0.35 + rand() * 0.5,
      speed: 0.35 + rand() * 0.5,
      seed: rand() * 100,
    }));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    // A swipe through the fire throws a shower of fast, wide-spreading sparks
    const bursting = burst.current !== seenBurst.current;
    seenBurst.current = burst.current;
    // Only a burning fire throws embers; the rest just finish their flight
    const burning = level.current > 0.2;
    particles.forEach((p, i) => {
      p.age += delta;
      if (!burning && p.age > p.life) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }
      if (p.age > p.life || (bursting && burning && Math.random() < 0.75)) {
        p.age = 0;
        p.x = (Math.random() - 0.5) * 0.25;
        p.z = (Math.random() - 0.5) * 0.25;
        p.y = 0.15;
        const spread = bursting ? 0.9 : 0.12;
        p.vx = (Math.random() - 0.5) * spread;
        p.vz = (Math.random() - 0.5) * spread;
        p.speed = p.baseSpeed * (bursting ? 2.4 : 1);
      }
      p.y += p.speed * delta;
      // Swept along by whatever is moving through the fire
      p.x += (p.vx + lean.current.vx * 0.5 + Math.sin(t * 2 + p.seed) * 0.08) * delta;
      p.z += (p.vz + lean.current.vz * 0.5 + Math.cos(t * 1.7 + p.seed) * 0.08) * delta;
      const fade = 1 - p.age / p.life;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.006 * fade + 0.001);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // Out of the ground occlusion bake: until the first frame places them, every ember is a 1 m sphere
    <instancedMesh ref={meshRef} args={[null, null, EMBER_COUNT]} frustumCulled={false} userData={NOT_OCCLUDER}>
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

/**
 * Soft smoke puffs that rise, expand and fade. `amount` scales them (0 = none);
 * `steam` (0..1) turns them into a fast, thick white plume, as when doused.
 */
const Smoke = ({ brightness, amount, steam }) => {
  const texture = useMemo(createSmokeTexture, []);
  const sprites = useRef([]);
  const puffs = useMemo(() => Array.from({ length: SMOKE_COUNT }, (_, i) => ({ offset: i / SMOKE_COUNT })), []);
  const LIFE = 6;
  const phase = useRef(0);
  const smokeColor = useMemo(() => new THREE.Color('#8b8d94').multiplyScalar(brightness), [brightness]);
  const steamColor = useMemo(() => new THREE.Color('#e9edf2').multiplyScalar(Math.max(0.45, brightness)), [brightness]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const st = steam.current;
    // Steam billows up several times faster than lazy wood smoke
    phase.current += (Math.min(delta, 1 / 20) / LIFE) * (1 + st * 3);
    puffs.forEach((p, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const age = ((phase.current + p.offset) % 1 + 1) % 1;
      sprite.position.set(Math.sin(t * 0.4 + i) * 0.15 + age * 0.5, 0.3 + age * 2.6, Math.cos(t * 0.3 + i) * 0.1);
      sprite.scale.setScalar((0.35 + age * 1.4) * (1 + st * 0.6));
      sprite.material.opacity = Math.min(0.85, Math.sin(age * Math.PI) * (0.22 * amount.current + 0.8 * st));
      sprite.material.color.lerpColors(smokeColor, steamColor, Math.min(1, st * 1.5));
      sprite.material.rotation = t * 0.1 + i;
      sprite.visible = sprite.material.opacity > 0.003;
    });
  });

  return puffs.map((_, i) => (
    <sprite key={i} ref={(s) => (sprites.current[i] = s)}>
      <spriteMaterial map={texture} color={smokeColor} transparent depthWrite={false} opacity={0} />
    </sprite>
  ));
};

/** Stylized firewood: chunky low-poly logs leaning into a loose pyramid. */
const Logs = ({ glow }) => {
  const logMaterials = useRef([]);
  const coalMaterial = useRef();
  const colors = useMemo(() => ({ bark: new THREE.Color(COLORS.bark), charred: new THREE.Color('#2e2724') }), []);
  useFrame(() => {
    const g = glow.current;
    // Doused logs go dark and charred until the fire is relit (or Sira lays fresh ones)
    logMaterials.current.forEach((m) => {
      if (!m) return;
      m.emissiveIntensity = 0.05 * g;
      m.color.lerpColors(colors.charred, colors.bark, Math.max(g, fire.fresh));
    });
    // Coals glow brightest as embers (no flames on top hiding them), dark when cold
    if (coalMaterial.current) coalMaterial.current.emissiveIntensity = 0.55 * g;
  });
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
            <meshStandardMaterial
              ref={(m) => (logMaterials.current[i] = m)}
              color={COLORS.bark}
              roughness={0.9}
              flatShading
              emissive="#ff4a10"
              emissiveIntensity={0.05}
            />
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
        <meshStandardMaterial ref={coalMaterial} color="#120a07" emissive="#ff4410" emissiveIntensity={0.55} roughness={1} />
      </mesh>
    </group>
  );
};

/**
 * A small flame burning on a prop (see Grabbable's burn effect). Follows the
 * prop's rigid body in world space and stays upright as it tumbles; `amount`
 * (ref, 0..1) sizes it.
 */
export const PropFlame = ({ body, amount, size = 0.1 }) => {
  const mesh = useRef();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSeed: { value: Math.random() }, uLean: { value: new THREE.Vector3() }, uStir: { value: 0.35 } }),
    []
  );
  useFrame(({ clock }) => {
    const m = mesh.current;
    const rb = body.current;
    if (!m || !rb) return;
    const a = amount.current;
    m.visible = a > 0.02;
    if (!m.visible) return;
    uniforms.uTime.value = clock.elapsedTime;
    // Trails behind the prop as it's carried
    const v = rb.linvel();
    uniforms.uLean.value.set(-v.x, 0, -v.z).multiplyScalar(0.04).clampLength(0, 0.12);
    const p = rb.translation();
    const h = (size * 2.6 + 0.08) * a;
    m.scale.set(size * 2.2 * (0.5 + 0.5 * a), Math.max(1e-3, h), 1);
    m.position.set(p.x, p.y + size * 0.4 + h / 2, p.z);
  });
  return (
    <mesh ref={mesh} visible={false} renderOrder={2} frustumCulled={false} raycast={() => null}>
      <planeGeometry args={[1, 1, 1, 8]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={flameVertexShader}
        fragmentShader={flameFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
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

// Fire light strength, and its height above the logs (m): higher spreads a broader, gentler pool
const FIRE_LIGHT = { intensity: 7, height: 0.8 };

/** Point light whose intensity and position flicker like a real fire. */
const FireLight = ({ castShadow, stir, level, glow }) => {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // A calm fire breathes rather than strobes: a few slow waves, no per-frame jitter
    const flicker = Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1 + 1.3) * 0.05 + Math.sin(t * 3.7 + 0.5) * 0.1;
    const light = lightRef.current;
    // Embers alone give off only a faint red glow
    // A disturbed fire flickers harder (not brighter overall)
    const disturbed = Math.min(1, stir.current) * (Math.sin(t * 31) * 0.18 + (Math.random() - 0.5) * 0.2);
    light.intensity = FIRE_LIGHT.intensity * (1 + flicker + disturbed) * (level.current + 0.1 * glow.current);
    light.position.set(Math.sin(t * 3.1) * 0.03, FIRE_LIGHT.height + Math.sin(t * 5.3) * 0.03, Math.cos(t * 2.7) * 0.03);
  });
  return (
    <pointLight
      ref={lightRef}
      color={COLORS.fire}
      intensity={FIRE_LIGHT.intensity}
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

/**
 * Campfire with a little life cycle (shared state in utils/play `fire`):
 *  - it slowly burns down to smoldering embers; tapping it adds fuel
 *  - anything moving through it (or a tap, a quick swipe) bends the flames
 *    along with it, tears them into flickering tongues and sweeps sparks out
 *  - water poured from the mug douses it in a burst of steam, leaving cold ash
 *  - a cold fire is relit by scraping the flint across the stones: the sparks
 *    heat the tinder until it smokes and catches, then the flames grow back
 */
const Campfire = ({ quality, ambient = 1 }) => {
  const lean = useRef({ x: 0, z: 0, vx: 0, vz: 0 }); // flame-tip offset (m) and its velocity
  const stir = useRef(0); // 0 = calm, ~1 = just disturbed
  const burst = useRef(0); // incremented per tap; embers react to changes
  const level = useRef(flameLevel(fire.fuel));
  const glow = useRef(glowLevel(fire.fuel));
  const smoke = useRef(level.current);
  const steam = useRef(0);
  const kindling = useRef(false);
  const lastColdHint = useRef(-Infinity);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);

    // Shoves from things passing through bend the flames, which spring back upright
    const L = lean.current;
    const push = fire.push;
    L.vx += push.x * LEAN_PER_PUSH;
    L.vz += push.z * LEAN_PER_PUSH;
    stir.current = Math.min(1.5, stir.current + Math.hypot(push.x, push.z) * STIR_PER_PUSH);
    push.x = 0;
    push.z = 0;
    L.vx += (-LEAN_STIFFNESS * L.x - LEAN_DAMPING * L.vx) * dt;
    L.vz += (-LEAN_STIFFNESS * L.z - LEAN_DAMPING * L.vz) * dt;
    L.x += L.vx * dt;
    L.z += L.vz * dt;
    const bend = Math.hypot(L.x, L.z);
    if (bend > MAX_LEAN) {
      L.x *= MAX_LEAN / bend;
      L.z *= MAX_LEAN / bend;
    }
    stir.current *= Math.exp(-STIR_DECAY * dt);

    if (fire.doused) {
      fire.doused = false;
      if (fire.fuel > 0) {
        fire.fuel = 0;
        fire.tinder = 0;
        fire.fresh = 0;
        kindling.current = false;
        steam.current = 1;
        // Sira putting it out for the night isn't the visitor's discovery
        if (!fire.dousedBySira) {
          discover('douse');
          notify('Fire’s out. Scrape the flint across the fire stones to relight it.');
        }
      }
      fire.dousedBySira = false;
    }

    if (fire.fuel <= 0 && fire.tinder >= 1) {
      // The tinder catches: a small flame that grows into a fire
      fire.tinder = 0;
      fire.fuel = 0.16;
      kindling.current = true;
      burst.current += 1;
      if (!fire.kindledBySira) discover('light');
    }
    fire.tinder = Math.max(0, fire.tinder - TINDER_COOL * dt);

    if (kindling.current) {
      fire.fuel = Math.min(KINDLED_FUEL, fire.fuel + KINDLE_RATE * dt);
      if (fire.fuel >= KINDLED_FUEL) kindling.current = false;
    } else if (fire.fuel > EMBER_FUEL) {
      fire.fuel = Math.max(EMBER_FUEL, fire.fuel - (BURN_BASE + BURN_PER_FUEL * fire.fuel) * dt);
    }
    // Rain (Krabi's live weather) hisses on it and slowly puts it out, embers and all
    const rain = weatherNow.rain;
    if (rain > 0.3 && fire.fuel > 0) {
      fire.fuel = Math.max(0, fire.fuel - RAIN_DOUSE * rain * dt);
      steam.current = Math.max(steam.current, 0.08 * rain * glow.current);
      if (fire.fuel === 0) {
        fire.tinder = 0;
        fire.fresh = 0;
        kindling.current = false;
      }
    }

    level.current = THREE.MathUtils.damp(level.current, flameLevel(fire.fuel), 3, dt);
    glow.current = THREE.MathUtils.damp(glow.current, Math.max(glowLevel(fire.fuel), fire.tinder * 0.6), 2, dt);
    steam.current *= Math.exp(-0.22 * dt);
    // Wood smoke from a fire, a thin wisp from embers, and smoke from heating tinder
    const smokeTarget = Math.max(level.current, glow.current * 0.35, fire.tinder);
    smoke.current = THREE.MathUtils.damp(smoke.current, smokeTarget, 1.5, dt);
  });

  // Sweeping the pointer (or a finger) through the flames pushes them about.
  // Pressing on the fire holds the camera still so a finger can swipe through it.
  const controls = useThree((state) => state.controls);
  const hand = useRef({ last: new THREE.Vector3(), at: 0, has: false, plane: null, token: null });
  const handPoint = useMemo(() => new THREE.Vector3(), []);
  const handPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LAYOUT.campfire.position[1] + HAND_PLANE_Y)), []);

  const releaseHand = () => {
    const h = hand.current;
    if (!h.token) return;
    held.delete(h.token);
    window.removeEventListener('pointerup', releaseHand);
    window.removeEventListener('pointercancel', releaseHand);
    h.token = null;
    if (controls && held.size === 0) controls.enabled = true;
  };
  // Let go of the camera if the fire unmounts mid-swipe
  useEffect(() => releaseHand, []);

  const handleSweep = (e) => {
    if (!e.ray.intersectPlane(handPlane, handPoint)) return;
    const h = hand.current;
    const now = performance.now() / 1000;
    const dt = now - h.at;
    if (h.has && dt > 0 && dt < HAND_GAP && level.current > 0.05) {
      const vx = (handPoint.x - h.last.x) / dt;
      const vz = (handPoint.z - h.last.z) / dt;
      const speed = Math.hypot(vx, vz);
      const k = speed > MAX_HAND_SPEED ? MAX_HAND_SPEED / speed : 1;
      stirFire(vx * k, vz * k, dt);
    }
    h.last.copy(handPoint);
    h.at = now;
    h.has = true;
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    hand.current.has = false;
    handleSweep(e);
    if (hand.current.token) return;
    hand.current.token = {};
    held.add(hand.current.token);
    if (controls) controls.enabled = false;
    window.addEventListener('pointerup', releaseHand);
    window.addEventListener('pointercancel', releaseHand);
  };

  const handleClick = (e) => {
    // Ignore clicks that were really camera drags or swipes
    if (e.delta > 6) return;
    e.stopPropagation();
    if (fire.fuel <= 0) {
      // Cold ash: tapping can't revive it (throttle the reminder)
      const now = performance.now();
      if (now - lastColdHint.current > 4000) {
        lastColdHint.current = now;
        notify('It’s cold. Scrape the flint across the fire stones to relight it.');
      }
      return;
    }
    // Blowing on embers or feeding a fire: more fuel, and a leap of flame
    fire.fuel = Math.min(1, fire.fuel + TAP_FUEL);
    kindling.current = false;
    // A quick swipe through the flames from a random side
    const a = Math.random() * Math.PI * 2;
    fire.push.x += Math.cos(a) * TAP_SWIPE * 0.12;
    fire.push.z += Math.sin(a) * TAP_SWIPE * 0.12;
    burst.current += 1;
    discover('stoke');
  };

  return (
    <group position={LAYOUT.campfire.position}>
      {/* Props bounce off the stone ring */}
      <RigidBody type="fixed" colliders={false} userData={{ hard: true }}>
        <CylinderCollider args={[0.06, RING_RADIUS + 0.08]} position={[0, 0.06, 0]} />
      </RigidBody>
      {/* Invisible target around the flames: tap to feed, sweep through to stir */}
      <mesh
        position={[0, 0.35, 0]}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handleSweep}
        onPointerOver={(e) => {
          e.stopPropagation();
          hand.current.has = false;
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          hand.current.has = false;
          document.body.style.cursor = '';
        }}
      >
        <cylinderGeometry args={[RING_RADIUS, RING_RADIUS, 0.7, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <Stones />
      <Logs glow={glow} />
      <Flames lean={lean} stir={stir} level={level} />
      <Embers burst={burst} level={level} lean={lean} />
      {/* Smoke is unlit, so dim it with the ambient light level (dark at night) */}
      <Smoke brightness={THREE.MathUtils.clamp(ambient, 0.12, 1)} amount={smoke} steam={steam} />
      <FireLight castShadow={quality.fireShadows} stir={stir} level={level} glow={glow} />
    </group>
  );
};

export { RING_RADIUS };
export default Campfire;
