import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { ISLAND, LAYOUT, TABLE } from './sceneConfig';
import { disturbWaves, isOverWater, waveHeightAt } from './utils/waves';
import { terrainHeight } from './Island';

const LIFT = 0.14; // how far a grabbed prop is lifted above where it was picked up
const MAX_DRAG_SPEED = 6;
const MAX_DRAG_RADIUS = 24; // far enough to carry things down to the sea
const CLICK_THRESHOLD_PX = 6;

/** Convert a point on the table top (local x/z) to world coordinates. */
const onTable = (x, z, lift = 0) => {
  const v = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), LAYOUT.table.rotationY);
  const [tx, , tz] = LAYOUT.table.position;
  return [tx + v.x, TABLE.height + lift, tz + v.z];
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
 * (a quick flick away from the camera). Camera controls pause while dragging.
 */
const Grabbable = ({ position, rotation = [0, 0, 0], buoyancy = 0, size = 0.1, children, ...bodyProps }) => {
  const inWater = useRef(false);
  const body = useRef();
  const grab = useRef(null);
  const controls = useThree((s) => s.controls);
  const spawn = useMemo(() => ({ position, rotation }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const release = (e) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'grab';
    if (!g.moved && body.current) {
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
      grab.current = {
        plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -(p.y + LIFT)),
        target: new THREE.Vector3(p.x, p.y + LIFT, p.z),
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        rayDirection: e.ray.direction.clone(),
      };
      if (controls) controls.enabled = false;
      document.body.style.cursor = 'grabbing';
      body.current.wakeUp();
    },
    onPointerMove: (e) => {
      const g = grab.current;
      if (!g) return;
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > CLICK_THRESHOLD_PX) g.moved = true;
      if (e.ray.intersectPlane(g.plane, tmp)) {
        // Keep props within the camp area
        const r = Math.hypot(tmp.x, tmp.z);
        if (r > MAX_DRAG_RADIUS) tmp.multiplyScalar(MAX_DRAG_RADIUS / r);
        g.target.set(tmp.x, g.target.y, tmp.z);
      }
    },
    onPointerUp: release,
    onLostPointerCapture: () => release(),
  };

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    floatInWater(rb, inWater, buoyancy, size, Math.min(delta, 1 / 30));
    const g = grab.current;
    if (g && g.moved) {
      // Spring the body toward the pointer; releasing keeps its momentum (a throw)
      const p = rb.translation();
      tmp.set(g.target.x - p.x, g.target.y - p.y, g.target.z - p.z).multiplyScalar(14);
      if (tmp.length() > MAX_DRAG_SPEED) tmp.setLength(MAX_DRAG_SPEED);
      rb.setLinvel(tmp, true);
      const w = rb.angvel();
      rb.setAngvel({ x: w.x * 0.85, y: w.y * 0.85, z: w.z * 0.85 }, true);
    }
    // Anything that escapes the world (or slips under the terrain) respawns where it started
    const p = rb.translation();
    if (p.y < -3 || p.y < terrainHeight(p.x, p.z) - 0.4) {
      rb.setTranslation({ x: spawn.position[0], y: spawn.position[1] + 0.3, z: spawn.position[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody ref={body} position={position} rotation={rotation} colliders={false} canSleep {...bodyProps}>
      <group {...handlers}>{children}</group>
    </RigidBody>
  );
};

const EnamelMug = ({ position }) => (
  <Grabbable position={position} rotation={[0, 0.8, 0]} friction={0.7} restitution={0.15}>
    <CylinderCollider args={[0.045, 0.042]} position={[0, 0.045, 0]} density={600} />
    <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.042, 0.04, 0.09, 24, 1, true]} />
      <meshStandardMaterial color="#2f5e8e" roughness={0.25} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.04, 24]} />
      <meshStandardMaterial color="#2f5e8e" roughness={0.3} />
    </mesh>
    {/* Inside: steaming coffee */}
    <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.039, 24]} />
      <meshStandardMaterial color="#2a1608" roughness={0.15} />
    </mesh>
    <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.042, 0.003, 6, 24]} />
      <meshStandardMaterial color="#1b1d20" roughness={0.4} metalness={0.6} />
    </mesh>
    <mesh position={[0.05, 0.048, 0]} castShadow>
      <torusGeometry args={[0.022, 0.005, 8, 16, Math.PI]} />
      <meshStandardMaterial color="#2f5e8e" roughness={0.25} />
    </mesh>
  </Grabbable>
);

const WaterBottle = ({ position }) => (
  <Grabbable position={position} rotation={[0, 0.3, 0]} buoyancy={1.4} size={0.12} friction={0.6} restitution={0.2}>
    <CylinderCollider args={[0.125, 0.035]} position={[0, 0.125, 0]} density={500} />
    <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.035, 0.035, 0.22, 24]} />
      <meshStandardMaterial color="#c8ccd2" metalness={0.95} roughness={0.25} />
    </mesh>
    <mesh position={[0, 0.235, 0]} castShadow>
      <cylinderGeometry args={[0.024, 0.03, 0.03, 20]} />
      <meshStandardMaterial color="#1f2a24" roughness={0.6} />
    </mesh>
  </Grabbable>
);

/** Camping lantern; its light moves with it when it's knocked over. */
/** Camping lantern; its light moves with it when it's knocked over. */
const Lantern = ({ position }) => {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (lightRef.current) lightRef.current.intensity = 0.9 + Math.sin(clock.elapsedTime * 8) * 0.03;
  });
  return (
    <Grabbable position={position} friction={0.6} restitution={0.1}>
      <CuboidCollider args={[0.045, 0.08, 0.045]} position={[0, 0.08, 0]} density={400} />
      <mesh position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.024, 12]} />
        <meshStandardMaterial color="#1e3a2b" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.038, 0.038, 0.11, 12]} />
        <meshStandardMaterial color="#ffd7a0" emissive="#ffb35c" emissiveIntensity={2.4} transparent opacity={0.85} roughness={0.1} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.148, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.028, 12]} />
        <meshStandardMaterial color="#1e3a2b" roughness={0.5} metalness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <torusGeometry args={[0.03, 0.003, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.3} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.09, 0]} color="#ffb766" intensity={0.9} distance={4} decay={2} />
    </Grabbable>
  );
};

const Coconut = ({ position, rotation }) => (
  <Grabbable position={position} rotation={rotation} buoyancy={1.8} size={0.095} friction={0.8} restitution={0.25} linearDamping={0.4} angularDamping={2.5}>
    <BallCollider args={[0.095]} density={700} />
    <mesh scale={[1, 0.92, 1.12]} castShadow receiveShadow>
      <sphereGeometry args={[0.095, 18, 14]} />
      <meshStandardMaterial color="#5a3f22" roughness={0.95} />
    </mesh>
  </Grabbable>
);

const PokeableProps = () => {
  const tableProps = useMemo(
    () => ({
      mug: onTable(0.26, 0.12, 0.002),
      bottle: onTable(-0.29, -0.15, 0.002),
      lantern: onTable(0.27, -0.14, 0.002),
    }),
    []
  );

  return (
    <group>
      <EnamelMug position={tableProps.mug} />
      <WaterBottle position={tableProps.bottle} />
      <Lantern position={tableProps.lantern} />
      <Coconut position={[1.5, 0.1, 1.85]} rotation={[0.3, 0, 0.2]} />
      <Coconut position={[-2.3, 0.1, 0.55]} rotation={[0, 1, 0.4]} />
      <Coconut position={[1.85, 0.1, -1.55]} rotation={[0.6, 2, 0]} />
      {/* On the flat camp ground facing the beach, ready to be thrown into the sea */}
      <Coconut position={[2.6, 0.15, 2.0]} rotation={[0.2, 0.5, 0]} />
      <Coconut position={[1.0, 0.15, 3.2]} rotation={[0.4, 2.5, 0.1]} />
    </group>
  );
};

// Memoized: the scene re-renders when the time of day changes, but this doesn't depend on it
export default React.memo(PokeableProps);
