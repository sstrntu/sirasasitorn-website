import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import { ISLAND, LAYOUT, TABLE } from './sceneConfig';
import { disturbWaves, isOverWater, waveHeightAt } from './utils/waves';
import { terrainHeight } from './Island';
import { lure } from './utils/lure';
import { createRockGeometry } from './utils/geometry';
import { discover, emitBurst, fire, held, loot, notify, on, stirFire, strikeFlint } from './utils/play';
import { PropFlame, RING_RADIUS } from './Campfire';
import HoldCue from './HoldCue';

const LIFT = 0.14; // how far a grabbed prop is lifted above where it was picked up
const MAX_DRAG_SPEED = 25;
/** Fraction of the gap to the pointer closed each frame while dragging (snappy, not springy). */
const DRAG_CATCH_UP = 0.65;
/** Throws are capped so a fast flick can't launch a prop off the island. */
const MAX_THROW_SPEED = 9;
/** Props within this radius of the flames (as seen on screen) bend them as they pass. */
const FLAME_RADIUS = 0.3;

/*
 * Burning: a prop held in or dropped on a lit fire heats up. It glows like
 * an ember, smokes and throws sparks, catches small flames of its own once
 * hot, and slowly chars (permanently). Water cools it at once.
 */
const HEAT_RATE = 0.7; // per second in the flames
const COOL_RATE = 0.14; // per second out of them (keeps burning a few seconds after)
const CHAR_RATE = 0.07; // per second while hot
const MAX_CHAR = 0.85;
const EMBER_GLOW = new THREE.Color('#ff5a14');
const CHARRED = new THREE.Color('#1c1612');
const SMOKE = [0.22, 0.21, 0.2];
const BURN_SPARKS = [5, 2, 0.5];

/** Glow and char a prop's materials (skips glass and other see-through parts). */
const applyBurn = (group, heat, char, flicker) => {
  group.traverse((o) => {
    const m = o.isMesh && o.material;
    if (!m || m.transparent || !m.emissive || o.userData.noBurn) return;
    if (!m.userData.burnBase) {
      m.userData.burnBase = { color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity };
    }
    const base = m.userData.burnBase;
    const glow = heat * (0.65 + 0.35 * flicker);
    m.color.copy(base.color).lerp(CHARRED, char);
    m.emissive.copy(base.emissive).lerp(EMBER_GLOW, Math.min(1, glow * 1.5));
    m.emissiveIntensity = THREE.MathUtils.lerp(base.intensity, 0.9, glow);
  });
};
const MAX_DRAG_RADIUS = 24; // far enough to carry things down to the sea
const CLICK_THRESHOLD_PX = 6;

/*
 * Touch screens: a fingertip would hide whatever it holds, so a held prop
 * floats a little above the finger instead of under it. Pressing and holding
 * a prop picks it up (a quick press is still a tap), and small props get a
 * hit area big enough for a finger.
 */
const TOUCH_LIFT_PX = 80;
const HOLD_MS = 180;
const TOUCH_HIT = { min: 0.08, max: 0.11 };
const COARSE_POINTER = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
/** Held props grow a touch, so it's clear what's in hand. */
const HELD_SCALE = 1.12;
const touchRay = new THREE.Raycaster();
const touchPoint = new THREE.Vector2();

/** Convert a point on the table top (local x/z) to world coordinates. */
const onTable = (x, z, lift = 0) => {
  const v = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), LAYOUT.table.rotationY);
  const [tx, , tz] = LAYOUT.table.position;
  return [tx + v.x, TABLE.height + lift, tz + v.z];
};

const FIRE_X = LAYOUT.campfire.position[0];
const FIRE_Z = LAYOUT.campfire.position[2];
/**
 * Is a held prop "over the fire" as the visitor sees it? Either straight
 * above the ring, or in front of it on the line of sight down to the fire
 * (props are carried in the air, so on screen they cover the fire from
 * closer to the camera).
 */
const looksOverFire = (camera, p, radius) => {
  const dx = p.x - FIRE_X;
  const dz = p.z - FIRE_Z;
  if (dx * dx + dz * dz < radius * radius) return true;
  const cam = camera.position;
  if (p.y <= 0.02 || cam.y <= p.y) return false;
  // Continue the camera ray through the prop down to the ground
  const t = cam.y / (cam.y - p.y);
  const gx = cam.x + (p.x - cam.x) * t - FIRE_X;
  const gz = cam.z + (p.z - cam.z) * t - FIRE_Z;
  return gx * gx + gz * gz < radius * radius;
};

/**
 * Water interaction for a prop: splashes (wave ripples) when it hits the sea,
 * then floats and drifts on the waves (`buoyancy` > 1) or sinks (0).
 */
const floatInWater = (rb, inWater, buoyancy, size, dt) => {
  const p = rb.translation();
  if (!isOverWater(p.x, p.z)) {
    inWater.current = false;
    return;
  }
  const surface = ISLAND.waterLevel + waveHeightAt(p.x, p.z);
  const submerged = THREE.MathUtils.clamp((surface - (p.y - size)) / (2 * size), 0, 1);
  if (submerged === 0) {
    inWater.current = false;
    return;
  }
  const v = rb.linvel();
  if (!inWater.current) {
    // Splash: a dent sized by how hard it hit, which rebounds into rings
    inWater.current = true;
    disturbWaves(p.x, p.z, 0.25 + size * 2, -Math.min(0.45, 0.06 + Math.abs(v.y) * 0.05 + size * 0.6));
  }
  const mass = rb.mass();
  // Buoyancy, water drag, and a push down the wave slopes so floaters drift
  const slopeX = (waveHeightAt(p.x + 0.3, p.z) - waveHeightAt(p.x - 0.3, p.z)) / 0.6;
  const slopeZ = (waveHeightAt(p.x, p.z + 0.3) - waveHeightAt(p.x, p.z - 0.3)) / 0.6;
  const lift = buoyancy * 9.81 * submerged;
  rb.applyImpulse({ x: -slopeX * 9.81 * submerged * mass * dt, y: lift * mass * dt, z: -slopeZ * 9.81 * submerged * mass * dt }, true);
  const drag = Math.exp(-3 * submerged * dt);
  rb.setLinvel({ x: v.x * drag, y: v.y * Math.exp(-5 * submerged * dt), z: v.z * drag }, true);
  const w = rb.angvel();
  rb.setAngvel({ x: w.x * drag, y: w.y * drag, z: w.z * drag }, true);
};

/**
 * Wraps a dynamic rigid body so it can be dragged (and thrown) or clicked
 * (a quick flick away from the camera, unless `onTap` handles the click).
 * Camera controls pause while dragging.
 */
const Grabbable = ({ position, rotation = [0, 0, 0], buoyancy = 0, size = 0.1, burnable = true, onTap, bodyRef, lootKind, children, ...bodyProps }) => {
  const inWater = useRef(false);
  const ownBody = useRef();
  const body = bodyRef || ownBody;
  const grab = useRef(null);
  const controls = useThree((s) => s.controls);
  const touchHit = useMemo(() => THREE.MathUtils.clamp(size * 1.6, TOUCH_HIT.min, TOUCH_HIT.max), [size]);
  const spawn = useMemo(() => ({ position, rotation }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const visual = useRef();
  const burn = useRef({ heat: 0, char: 0, puffAt: 0, sparkAt: 0, applied: false });
  const flame = useRef(0); // size of the prop's own flame (0..1)

  const release = (e) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    held.delete(g);
    window.removeEventListener('pointerup', g.onWindowUp);
    window.removeEventListener('pointercancel', g.onWindowUp);
    if (controls && held.size === 0) controls.enabled = true;
    document.body.style.cursor = 'grab';
    if (g.moved && body.current) {
      const v = body.current.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > MAX_THROW_SPEED) {
        const k = MAX_THROW_SPEED / speed;
        body.current.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
    }
    if (!g.moved && onTap) {
      onTap();
    } else if (!g.moved && body.current) {
      // Treat as a click: flick the prop along the view direction, plus a hop
      const mass = body.current.mass();
      const dir = g.rayDirection.clone().setY(0).normalize();
      body.current.applyImpulse({ x: dir.x * mass * 1.6, y: mass * 2.2, z: dir.z * mass * 1.6 }, true);
      body.current.applyTorqueImpulse({ x: (Math.random() - 0.5) * mass * 0.02, y: 0, z: (Math.random() - 0.5) * mass * 0.02 }, true);
    }
    e?.target?.releasePointerCapture?.(e.pointerId);
  };

  const handlers = {
    onPointerOver: (e) => {
      e.stopPropagation();
      if (!grab.current) document.body.style.cursor = 'grab';
    },
    onPointerOut: () => {
      if (!grab.current) document.body.style.cursor = '';
    },
    onPointerDown: (e) => {
      e.stopPropagation();
      e.target.setPointerCapture(e.pointerId);
      const p = body.current.translation();
      const g = {
        plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -(p.y + LIFT)),
        target: new THREE.Vector3(p.x, p.y + LIFT, p.z),
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        rayDirection: e.ray.direction.clone(),
        // Touch: where the finger is, when it went down, and how far above it the prop floats (px)
        touch: e.pointerType === 'touch',
        clientX: e.clientX,
        clientY: e.clientY,
        downAt: performance.now(),
        lift: 0,
        // For the hold cue (ring and drop shadow)
        body,
        size,
        // Backup release in case the pointer is let go somewhere R3F doesn't report
        onWindowUp: () => release(),
      };
      grab.current = g;
      held.add(g);
      window.addEventListener('pointerup', g.onWindowUp);
      window.addEventListener('pointercancel', g.onWindowUp);
      if (controls) controls.enabled = false;
      document.body.style.cursor = 'grabbing';
      body.current.wakeUp();
    },
    onPointerMove: (e) => {
      const g = grab.current;
      if (!g) return;
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > CLICK_THRESHOLD_PX) g.moved = true;
      g.clientX = e.clientX;
      g.clientY = e.clientY;
      // A finger's target is worked out each frame, above the fingertip
      if (!g.touch && e.ray.intersectPlane(g.plane, tmp)) aimAt(g, tmp);
    },
    onPointerUp: release,
    onLostPointerCapture: () => release(),
  };

  /** Drag toward a point on the grab plane, kept within the camp area. */
  const aimAt = (g, point) => {
    const r = Math.hypot(point.x, point.z);
    if (r > MAX_DRAG_RADIUS) point.multiplyScalar(MAX_DRAG_RADIUS / r);
    g.target.set(point.x, g.target.y, point.z);
  };

  // Something a monkey could steal (utils/play `loot`) while it exists
  useEffect(() => {
    if (!lootKind) return undefined;
    const entry = { body, kind: lootKind, size, held: () => Boolean(grab.current) };
    loot.add(entry);
    return () => loot.delete(entry);
  }, [body, lootKind, size]);

  // Removed while held (a coconut cracking in hand, or cleared away): let go of it
  useEffect(
    () => () => {
      const g = grab.current;
      if (!g) return;
      grab.current = null;
      held.delete(g);
      window.removeEventListener('pointerup', g.onWindowUp);
      window.removeEventListener('pointercancel', g.onWindowUp);
      document.body.style.cursor = '';
    },
    []
  );

  useFrame(({ camera, size: view }, delta) => {
    const rb = body.current;
    if (!rb) return;
    floatInWater(rb, inWater, buoyancy, size, Math.min(delta, 1 / 30));
    const g = grab.current;
    if (g?.touch) {
      // Held still for a moment: picked up (letting go then just puts it down, not a tap)
      if (!g.moved && performance.now() - g.downAt > HOLD_MS) g.moved = true;
      if (g.moved) {
        // Rise above the fingertip, then follow the point just above it
        g.lift = THREE.MathUtils.damp(g.lift, TOUCH_LIFT_PX, 14, delta);
        touchPoint.set(((g.clientX - view.left) / view.width) * 2 - 1, -((g.clientY - g.lift - view.top) / view.height) * 2 + 1);
        touchRay.setFromCamera(touchPoint, camera);
        if (touchRay.ray.intersectPlane(g.plane, tmp)) aimAt(g, tmp);
      }
    }
    if (visual.current) {
      const k = THREE.MathUtils.damp(visual.current.scale.x, g ? HELD_SCALE : 1, 12, delta);
      visual.current.scale.setScalar(k);
    }
    if (g && g.moved) {
      // Drive the body to the pointer within a frame or two; releasing keeps its momentum (a throw)
      const p = rb.translation();
      const gain = Math.min(DRAG_CATCH_UP / Math.max(delta, 1 / 240), 60);
      tmp.set(g.target.x - p.x, g.target.y - p.y, g.target.z - p.z).multiplyScalar(gain);
      if (tmp.length() > MAX_DRAG_SPEED) tmp.setLength(MAX_DRAG_SPEED);
      rb.setLinvel(tmp, true);
      const w = rb.angvel();
      rb.setAngvel({ x: w.x * 0.85, y: w.y * 0.85, z: w.z * 0.85 }, true);
    }
    const p = rb.translation();
    const dt = Math.min(delta, 1 / 20);
    // Moving through the campfire pushes the flames along with it
    const inFlames = p.y < 1.1 && looksOverFire(camera, p, FLAME_RADIUS);
    if (inFlames) {
      const v = rb.linvel();
      if (v.x * v.x + v.z * v.z > 0.04) stirFire(v.x, v.z, dt);
    }

    // ...and heats it up: glow, smoke, sparks, flames and charring
    const b = burn.current;
    const lit = fire.fuel > 0.15;
    if (inWater.current || !burnable) b.heat = 0;
    else b.heat = THREE.MathUtils.clamp(b.heat + (inFlames && lit ? HEAT_RATE : -COOL_RATE) * dt, 0, 1);
    if (b.heat > 0.5) b.char = Math.min(MAX_CHAR, b.char + CHAR_RATE * dt);
    flame.current = THREE.MathUtils.smoothstep(b.heat, 0.55, 0.95);
    if (b.heat > 0.6) discover('burn');
    if ((b.heat > 0 || b.applied) && visual.current) {
      const t = performance.now() / 1000;
      applyBurn(visual.current, b.heat, b.char, 0.5 + 0.5 * Math.sin(t * 17 + p.x * 9));
      b.applied = b.heat > 0;
      const top = { x: p.x, y: p.y + size * 0.6, z: p.z };
      if (b.heat > 0.25 && t - b.puffAt > 0.22 - b.heat * 0.12) {
        b.puffAt = t;
        emitBurst({ position: top, count: 1, color: SMOKE, speed: 0.06, up: 0.2, gravity: -0.5, life: 1.4, size: 0.022 });
      }
      if (b.heat > 0.4 && t - b.sparkAt > 0.35 - b.heat * 0.2) {
        b.sparkAt = t;
        emitBurst({ position: top, count: 2, color: BURN_SPARKS, speed: 0.25, up: 1.2, gravity: -0.3, life: 0.9, size: 0.005 });
      }
    }
    // Anything that escapes the world (or slips under the terrain) respawns where it started
    if (p.y < -3 || p.y < terrainHeight(p.x, p.z) - 0.4) {
      rb.setTranslation({ x: spawn.position[0], y: spawn.position[1] + 0.3, z: spawn.position[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <>
      <RigidBody ref={body} position={position} rotation={rotation} colliders={false} canSleep {...bodyProps}>
        <group ref={visual} {...handlers}>
          {children}
          {COARSE_POINTER && (
            <mesh userData={{ noBurn: true }}>
              <sphereGeometry args={[touchHit, 10, 8]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          )}
        </group>
      </RigidBody>
      <PropFlame body={body} amount={flame} size={size} />
    </>
  );
};

const MUG_TIP = 1.9; // radians the mug tips to pour
const POUR_SECONDS = 0.9;
const LIQUID = {
  coffee: { color: '#2a1608', drops: [0.22, 0.12, 0.05] },
  water: { color: '#3f86ad', drops: [0.6, 0.8, 1] },
};

/**
 * Enamel mug (starts with coffee). Carry it over the campfire and it tips and
 * pours, putting the fire out. Drop it in the sea to refill it with water.
 */
const EnamelMug = ({ position }) => {
  const body = useRef();
  const tilt = useRef();
  const spout = useRef();
  const [contents, setContents] = useState('coffee');
  const contentsRef = useRef('coffee');
  const pour = useRef({ angle: 0, time: 0, emptyHintAt: -Infinity });
  const rim = useMemo(() => new THREE.Vector3(), []);

  const fill = useCallback((next) => {
    contentsRef.current = next;
    setContents(next);
  }, []);

  useFrame(({ clock, camera }, delta) => {
    const rb = body.current;
    if (!rb || !tilt.current) return;
    const dt = Math.min(delta, 1 / 20);
    const p = rb.translation();
    const state = pour.current;
    const liquid = contentsRef.current;

    if (liquid !== 'water' && isOverWater(p.x, p.z) && p.y < ISLAND.waterLevel + waveHeightAt(p.x, p.z) + 0.03) {
      fill('water');
      notify('Filled the mug with sea water');
      return;
    }

    const overFire = p.y < 1.8 && looksOverFire(camera, p, RING_RADIUS);
    if (overFire && liquid === 'empty' && clock.elapsedTime - state.emptyHintAt > 5) {
      state.emptyHintAt = clock.elapsedTime;
      notify('The mug is empty. Drop it in the sea to refill it.');
    }
    const pouring = overFire && liquid !== 'empty';
    state.angle = THREE.MathUtils.damp(state.angle, pouring ? 1 : 0, 6, dt);
    tilt.current.rotation.z = -state.angle * MUG_TIP;

    if (pouring && state.angle > 0.7) {
      state.time += dt;
      spout.current.getWorldPosition(rim);
      emitBurst({ position: rim, count: 3, color: LIQUID[liquid].drops, speed: 0.12, up: 0.2, gravity: 9.8, life: 0.45, size: 0.009 });
      if (state.time > POUR_SECONDS) {
        state.time = 0;
        state.emptyHintAt = clock.elapsedTime; // no "it's empty" nag right after pouring
        fill('empty');
        if (fire.fuel > 0) fire.doused = true;
        else notify('Splash! The mug is empty. Drop it in the sea to refill it.');
      }
    } else {
      state.time = Math.max(0, state.time - dt);
    }
  });

  return (
    <Grabbable bodyRef={body} position={position} rotation={[0, 0.8, 0]} buoyancy={1.3} size={0.05} friction={0.7} restitution={0.15} lootKind="mug">
      <CylinderCollider args={[0.045, 0.042]} position={[0, 0.045, 0]} density={600} />
      {/* Tips over (around its base) to pour; the physics body stays upright */}
      <group ref={tilt}>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.042, 0.04, 0.09, 24, 1, true]} />
          <meshStandardMaterial color="#2f5e8e" roughness={0.25} metalness={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.04, 24]} />
          <meshStandardMaterial color="#2f5e8e" roughness={0.3} />
        </mesh>
        {contents !== 'empty' && (
          <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noBurn: true }}>
            <circleGeometry args={[0.039, 24]} />
            <meshStandardMaterial color={LIQUID[contents].color} roughness={0.15} />
          </mesh>
        )}
        <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.042, 0.003, 6, 24]} />
          <meshStandardMaterial color="#1b1d20" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[-0.05, 0.048, 0]} rotation={[0, Math.PI, 0]} castShadow>
          <torusGeometry args={[0.022, 0.005, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#2f5e8e" roughness={0.25} />
        </mesh>
        {/* Where the liquid leaves the rim when tipped */}
        <group ref={spout} position={[0.045, 0.09, 0]} />
      </group>
    </Grabbable>
  );
};

/** Horizontal speed (m/s) the flint must scrape across the fire stones to spark. */
const STRIKE_SPEED = 1.4;
const STRIKE_INTERVAL = 0.09;

/**
 * Flint: a dark stone beside the fire. Scrape it quickly across the fire
 * ring and it throws sparks; enough sparks relight a cold fire.
 */
const Flint = ({ position }) => {
  const body = useRef();
  const lastStrike = useRef(0);
  const geometry = useMemo(() => createRockGeometry(41, 0.06, 1), []);
  // Label the flint while the fire is cold, so visitors know what relights it
  const [cold, setCold] = useState(fire.fuel <= 0);

  useFrame(({ clock, camera }) => {
    const rb = body.current;
    if (!rb) return;
    if (cold !== fire.fuel <= 0) setCold(fire.fuel <= 0);
    const p = rb.translation();
    const v = rb.linvel();
    const near = p.y < 0.6 && looksOverFire(camera, p, RING_RADIUS + 0.12);
    if (near && Math.hypot(v.x, v.z) > STRIKE_SPEED && clock.elapsedTime - lastStrike.current > STRIKE_INTERVAL) {
      lastStrike.current = clock.elapsedTime;
      strikeFlint(p);
    }
  });

  return (
    <Grabbable bodyRef={body} position={position} rotation={[0.2, 0.6, 0]} size={0.05} burnable={false} friction={0.8} restitution={0.1}>
      <BallCollider args={[0.05]} density={2600} />
      <mesh geometry={geometry} scale={[1.3, 0.75, 1]} castShadow receiveShadow>
        <meshStandardMaterial color="#2e3440" roughness={0.35} metalness={0.2} flatShading />
      </mesh>
      {cold && (
        <Html position={[0, 0.16, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="jungle-laptop-hint is-visible">Flint: scrape it on the stones</div>
        </Html>
      )}
    </Grabbable>
  );
};

/** Seconds the fireflies keep following the lantern after it stops moving. */
const LURE_LINGER = 4;

/**
 * Camping lantern: grab it to carry its light around the camp at night
 * (fireflies follow it), tap it to switch it on or off.
 */
const Lantern = ({ position }) => {
  const lightRef = useRef();
  const glassRef = useRef();
  const [lit, setLit] = useState(true);
  const level = useRef(1); // eased on/off level
  const last = useRef(null); // previous world position (none until the first frame)
  const movedAt = useRef(-Infinity);
  const world = useMemo(() => new THREE.Vector3(), []);
  const toggle = useCallback(() => {
    setLit((v) => !v);
    discover('lantern');
  }, []);

  useFrame(({ clock }, delta) => {
    const light = lightRef.current;
    if (!light) return;
    const t = clock.elapsedTime;
    // Ease on/off with a brief flicker, like a real LED lantern warming up
    level.current = THREE.MathUtils.damp(level.current, lit ? 1 : 0, lit ? 7 : 12, delta);
    const flicker = lit && level.current < 0.9 ? 0.6 + Math.random() * 0.4 : 1;
    const on = level.current * flicker;
    light.intensity = (1.6 + Math.sin(t * 8) * 0.05) * on;
    glassRef.current.emissiveIntensity = 0.15 + 2.6 * on;

    light.getWorldPosition(world);
    // Only a visitor moving it counts (not settling onto the table at load)
    const settling = t < 3;
    if (!last.current) last.current = world.clone();
    else if (!settling && world.distanceToSquared(last.current) > 0.0004) movedAt.current = t;
    last.current.copy(world);
    lure.position.copy(world);
    lure.active = lit && t - movedAt.current < LURE_LINGER;
  });

  return (
    <Grabbable position={position} friction={0.6} restitution={0.1} onTap={toggle}>
      <CuboidCollider args={[0.045, 0.08, 0.045]} position={[0, 0.08, 0]} density={400} />
      <mesh position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.024, 12]} />
        <meshStandardMaterial color="#1e3a2b" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.038, 0.038, 0.11, 12]} />
        <meshStandardMaterial ref={glassRef} color="#ffd7a0" emissive="#ffb35c" emissiveIntensity={2.4} transparent opacity={0.85} roughness={0.1} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.148, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.028, 12]} />
        <meshStandardMaterial color="#1e3a2b" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <torusGeometry args={[0.03, 0.003, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Reaches far enough to light the ground around whoever is carrying it */}
      <pointLight ref={lightRef} position={[0, 0.09, 0]} color="#ffb766" intensity={1.6} distance={6} decay={2} />
    </Grabbable>
  );
};

/** Impact speed (m/s) against a rock or the fire stones that cracks a coconut. */
const CRACK_SPEED = 3.2;
const TAPS_TO_CRACK = 3;
const COCONUT_SCALE = [1, 0.92, 1.12];

/**
 * Coconut: throw it hard at a rock (or tap it a few times) and it cracks
 * open into two halves. `onCrack(id, position, velocity)` swaps it out.
 */
const Coconut = ({ id, position, rotation, onCrack }) => {
  const body = useRef();
  const speed = useRef(0);
  const hits = useRef(0);
  const cracked = useRef(false);
  const [cracks, setCracks] = useState(0);

  const crack = () => {
    const rb = body.current;
    if (cracked.current || !rb) return;
    cracked.current = true;
    const p = rb.translation();
    const v = rb.linvel();
    // Swap bodies outside the physics step that reported the hit
    setTimeout(() => onCrack(id, p, v), 0);
  };

  const whack = () => {
    const rb = body.current;
    if (!rb) return;
    const mass = rb.mass();
    rb.applyImpulse({ x: 0, y: mass * 1.3, z: 0 }, true);
    rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * mass * 0.03, y: 0, z: (Math.random() - 0.5) * mass * 0.03 }, true);
    hits.current += 1;
    setCracks(hits.current);
    if (hits.current >= TAPS_TO_CRACK) crack();
  };

  useFrame(() => {
    const v = body.current?.linvel();
    if (v) speed.current = Math.hypot(v.x, v.y, v.z);
  });

  return (
    <Grabbable
      bodyRef={body}
      position={position}
      rotation={rotation}
      buoyancy={1.8}
      size={0.095}
      friction={0.8}
      restitution={0.25}
      linearDamping={0.4}
      angularDamping={2.5}
      lootKind="coconut"
      onTap={whack}
      onCollisionEnter={({ other }) => {
        if (other.rigidBody?.userData?.hard && speed.current > CRACK_SPEED) crack();
      }}
    >
      <BallCollider args={[0.095]} density={700} />
      <group scale={COCONUT_SCALE}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.095, 18, 14]} />
          <meshStandardMaterial color="#5a3f22" roughness={0.95} />
        </mesh>
        {/* A crack that spreads around the shell with each whack */}
        {cracks > 0 && (
          <mesh rotation={[0, 0, cracks * 0.7]}>
            <torusGeometry args={[0.0955, 0.0035, 4, 32, (Math.PI * 2 * Math.min(cracks, TAPS_TO_CRACK - 0.4)) / TAPS_TO_CRACK]} />
            <meshStandardMaterial color="#1a1008" roughness={1} />
          </mesh>
        )}
      </group>
    </Grabbable>
  );
};

const FLESH = '#f3eee2';

/** Half a cracked coconut: a brown bowl lined with white flesh (cut face is local +Y). */
const CoconutHalf = ({ position, rotation, velocity }) => (
  <Grabbable
    position={position}
    rotation={rotation}
    linearVelocity={velocity}
    angularVelocity={[(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6]}
    buoyancy={1.6}
    size={0.06}
    friction={0.8}
    restitution={0.2}
    linearDamping={0.4}
    angularDamping={2}
  >
    <CylinderCollider args={[0.035, 0.09]} position={[0, -0.04, 0]} density={500} />
    <group scale={COCONUT_SCALE}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.095, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#5a3f22" roughness={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.085, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={FLESH} roughness={0.6} side={THREE.BackSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.085, 0.095, 24]} />
        <meshStandardMaterial color={FLESH} roughness={0.6} />
      </mesh>
    </group>
  </Grabbable>
);

const INITIAL_COCONUTS = [
  { position: [1.5, 0.1, 1.85], rotation: [0.3, 0, 0.2] },
  { position: [-2.3, 0.1, 0.55], rotation: [0, 1, 0.4] },
  { position: [1.85, 0.1, -1.55], rotation: [0.6, 2, 0] },
  // On the flat camp ground facing the beach, ready to be thrown into the sea
  { position: [2.6, 0.15, 2.0], rotation: [0.2, 0.5, 0] },
  { position: [1.0, 0.15, 3.2], rotation: [0.4, 2.5, 0.1] },
];
// Oldest coconuts (whole or halves) are cleared away beyond these counts
const MAX_WHOLE = 9;
const MAX_HALVES = 10;
const JUICE = [0.95, 0.97, 1];

const UP = new THREE.Vector3(0, 1, 0);

const capCoconuts = (list) => {
  const wholes = list.filter((n) => n.kind === 'whole');
  const halves = list.filter((n) => n.kind === 'half');
  const drop = new Set([...wholes.slice(0, Math.max(0, wholes.length - MAX_WHOLE)), ...halves.slice(0, Math.max(0, halves.length - MAX_HALVES))]);
  return drop.size ? list.filter((n) => !drop.has(n)) : list;
};

/** The coconuts on the island: the starting ones, ones shaken from palms, and cracked halves. */
const Coconuts = () => {
  const nextId = useRef(INITIAL_COCONUTS.length);
  const [nuts, setNuts] = useState(() => INITIAL_COCONUTS.map((n, id) => ({ id, kind: 'whole', ...n })));

  useEffect(
    () =>
      on('coconutDrop', ({ position }) => {
        const id = nextId.current++;
        const rotation = [Math.random() * 3, Math.random() * 3, Math.random() * 3];
        setNuts((list) => capCoconuts([...list, { id, kind: 'whole', position, rotation }]));
      }),
    []
  );

  const handleCrack = useCallback((id, p, v) => {
    const axis = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, Math.random() * Math.PI * 2);
    const halves = [1, -1].map((side) => {
      // Both halves land open side up-ish, flying apart along the crack
      const facing = axis.clone().multiplyScalar(side * 0.6).add(new THREE.Vector3(0, 0.8, 0)).normalize();
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, facing));
      return {
        id: nextId.current++,
        kind: 'half',
        position: [p.x + axis.x * side * 0.05, p.y + 0.03, p.z + axis.z * side * 0.05],
        rotation: [rotation.x, rotation.y, rotation.z],
        velocity: [v.x * 0.3 + axis.x * side * 0.7, Math.max(0, v.y * 0.3) + 1.1, v.z * 0.3 + axis.z * side * 0.7],
      };
    });
    setNuts((list) => capCoconuts([...list.filter((n) => n.id !== id), ...halves]));
    emitBurst({ position: { x: p.x, y: p.y + 0.05, z: p.z }, count: 24, color: JUICE, speed: 1.1, up: 1.6, gravity: 9.8, life: 0.7, size: 0.011 });
    discover('crack');
  }, []);

  return nuts.map((n) =>
    n.kind === 'whole' ? (
      <Coconut key={n.id} id={n.id} position={n.position} rotation={n.rotation} onCrack={handleCrack} />
    ) : (
      <CoconutHalf key={n.id} position={n.position} rotation={n.rotation} velocity={n.velocity} />
    )
  );
};

const PokeableProps = () => {
  const tableProps = useMemo(
    () => ({
      mug: onTable(0.26, 0.12, 0.002),
      lantern: onTable(0.27, -0.14, 0.002),
    }),
    []
  );
  // On the ground just outside the fire ring, on the side facing the camera
  const flint = useMemo(() => [FIRE_X + 0.55, 0.06, FIRE_Z + 0.3], []);

  return (
    <group>
      <EnamelMug position={tableProps.mug} />
      <Lantern position={tableProps.lantern} />
      <Flint position={flint} />
      <Coconuts />
      <HoldCue />
    </group>
  );
};

// Memoized: the scene re-renders when the time of day changes, but this doesn't depend on it
export default React.memo(PokeableProps);
