import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { LAYOUT, TABLE } from './sceneConfig';

const POLE_RADIUS = 0.0085;

// Light-blue anodized aluminium poles, as on Helinox-style camp furniture
export const pole = { color: '#6fb3d2', metalness: 0.55, roughness: 0.35 };

/** Thin pole between two points (shock-corded tent-pole style frame). */
export const Pole = ({ from, to, radius = POLE_RADIUS, material = pole }) => {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial {...material} />
    </mesh>
  );
};

/** Black plastic hub where the poles meet. */
export const Hub = ({ position, size = 0.024 }) => (
  <mesh position={position} castShadow>
    <boxGeometry args={[size * 1.6, size * 1.4, size * 1.6]} />
    <meshStandardMaterial color="#1b1c1f" roughness={0.6} />
  </mesh>
);

/** Rubber foot at the end of a leg. */
const Foot = ({ position }) => (
  <mesh position={position} castShadow>
    <sphereGeometry args={[0.012, 8, 6]} />
    <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
  </mesh>
);

/**
 * Ultralight camp table in the style of a Helinox Table One Hard Top: a
 * black hard top with a thin dark rim on a light-blue pole frame. A single
 * hub under the middle sends four arms up to the top's corners and four legs
 * splaying down to the ground.
 * Children (the laptop, props) are positioned relative to the table top.
 */
const CampTable = ({ children }) => {
  const { width, depth, height, topThickness } = TABLE;
  const topY = height - topThickness / 2;
  const underY = height - topThickness;
  const hub = [0, height * 0.4, 0];
  const cornerX = width / 2 - 0.03;
  const cornerZ = depth / 2 - 0.03;
  const footX = width / 2 - 0.02;
  const footZ = depth / 2 + 0.02;

  return (
    <group position={LAYOUT.table.position} rotation={[0, LAYOUT.table.rotationY, 0]}>
      <RigidBody type="fixed" colliders={false} friction={0.8}>
        <CuboidCollider args={[width / 2, topThickness / 2, depth / 2]} position={[0, topY, 0]} />
      </RigidBody>

      {/* Hard top: matte black panel with a slightly glossier rim */}
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, topThickness, depth]} />
        <meshStandardMaterial color="#202124" roughness={0.75} userData={{ envBase: 0.3 }} />
      </mesh>
      <mesh position={[0, topY - 0.002, 0]}>
        <boxGeometry args={[width + 0.008, topThickness * 0.7, depth + 0.008]} />
        <meshStandardMaterial color="#111214" roughness={0.5} />
      </mesh>
      {/* Corner pockets the arms slot into */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * cornerX, underY - 0.008, sz * cornerZ]}>
            <boxGeometry args={[0.03, 0.016, 0.03]} />
            <meshStandardMaterial color="#1b1c1f" roughness={0.6} />
          </mesh>
        ))
      )}

      <Hub position={hub} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Pole from={hub} to={[sx * cornerX, underY - 0.01, sz * cornerZ]} />
            <Pole from={hub} to={[sx * footX, 0.012, sz * footZ]} />
            <Foot position={[sx * footX, 0.012, sz * footZ]} />
          </group>
        ))
      )}

      <group position={[0, height, 0]}>{children}</group>
    </group>
  );
};

export default CampTable;
