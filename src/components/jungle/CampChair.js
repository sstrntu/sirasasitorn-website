import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { LAYOUT } from './sceneConfig';
import { Hub, Pole } from './CampTable';

/*
 * Low beach-style camp chair with a high back (in the style of a Helinox
 * Sunset / Beach chair): a grey mesh sling between light-blue shock-corded
 * poles. Sized to Sira's build (his torso is broad and long for his legs): the
 * seat is low, so his heels reach the ground, wider than his shoulders, and
 * the backrest leans back ~30° and reaches behind his head, so he can sink in
 * and nap against it. Two hubs under the seat, joined by a crossbar, each send
 * a leg forward and back to the ground and an arm up to the seat's front
 * corner and the backrest's top corner. The seat faces local +Z.
 */
const HALF_WIDTH = 0.31;
const FRONT = { y: 0.25, z: 0.28 };
const BACK_TOP = { y: 1.08, z: -0.64 };
const HUB_Y = 0.1;
// Hubs sit toward the back so the back arms run behind the fabric, not across it
const HUB_Z = -0.12;
// How far the fabric sags between the side poles (m)
const SAG = 0.04;

/** Side profile of the sling at its side poles, front edge -> seat -> backrest top (y, z). */
const PROFILE = [
  [FRONT.y, FRONT.z],
  [0.21, 0.15],
  [0.19, 0.0],
  [0.22, -0.15],
  [0.45, -0.28],
  [0.75, -0.45],
  [BACK_TOP.y, BACK_TOP.z],
];

/** Where Sira's hips sit (local [y, z], mid-sling): just ahead of the lowest point, so his back meets the backrest (utils/siraActivities.js). */
export const CHAIR_SEAT = { y: 0.19 - SAG, z: 0.07 };

const buildSeatGeometry = () => {
  const curve = new THREE.CatmullRomCurve3(PROFILE.map(([y, z]) => new THREE.Vector3(0, y, z)));
  const along = 28;
  const across = 10;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= along; i++) {
    const p = curve.getPointAt(i / along);
    for (let j = 0; j <= across; j++) {
      const u = (j / across) * 2 - 1;
      // Fabric sags between the side edges
      const sag = (1 - u * u) * SAG;
      positions.push(u * HALF_WIDTH, p.y - sag, p.z + sag * 0.6);
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const Foot = ({ position }) => (
  <mesh position={position} castShadow>
    <sphereGeometry args={[0.013, 8, 6]} />
    <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
  </mesh>
);

// The backrest's lean back from vertical (radians), for its collider
const BACK_LEAN = Math.atan2(BACK_TOP.z - PROFILE[3][1], BACK_TOP.y - PROFILE[3][0]);

const CampChair = () => {
  const seat = useMemo(buildSeatGeometry, []);
  const { position, rotationY } = LAYOUT.chair;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HALF_WIDTH, 0.11, 0.23]} position={[0, 0.11, 0.05]} />
        <CuboidCollider args={[HALF_WIDTH, 0.48, 0.03]} position={[0, 0.65, -0.4]} rotation={[BACK_LEAN, 0, 0]} />
      </RigidBody>

      {/* Grey mesh fabric sling with darker binding along the seat's edges */}
      <mesh geometry={seat} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3c40" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * HALF_WIDTH * 0.99, 0.2, 0.07]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.012, 0.012, 0.44]} />
          <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
        </mesh>
      ))}

      {/* Crossbar between the two hubs */}
      <Pole from={[-0.18, HUB_Y, HUB_Z]} to={[0.18, HUB_Y, HUB_Z]} />
      {[-1, 1].map((sx) => {
        const hub = [sx * 0.18, HUB_Y, HUB_Z];
        const frontFoot = [sx * 0.3, 0.012, 0.26];
        const backFoot = [sx * 0.3, 0.012, -0.46];
        return (
          <group key={sx}>
            <Hub position={hub} size={0.02} />
            <Pole from={hub} to={frontFoot} />
            <Pole from={hub} to={backFoot} />
            <Foot position={frontFoot} />
            <Foot position={backFoot} />
            {/* Arms up to the seat's front corner and the backrest's top corner (fabric pockets) */}
            <Pole from={hub} to={[sx * (HALF_WIDTH - 0.02), FRONT.y - 0.02, FRONT.z - 0.02]} />
            <Pole from={hub} to={[sx * (HALF_WIDTH - 0.02), BACK_TOP.y - 0.02, BACK_TOP.z - 0.03]} />
          </group>
        );
      })}
    </group>
  );
};

export default React.memo(CampChair);
