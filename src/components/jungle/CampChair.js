import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { LAYOUT } from './sceneConfig';
import { Hub, Pole } from './CampTable';

/*
 * Low ultralight camp chair in the style of a Helinox Chair Zero: a grey mesh
 * bucket seat slung between light-blue shock-corded poles. Two hubs under the
 * seat, joined by a crossbar, each send a leg forward and back to the ground
 * and an arm up to the seat's front corner and the backrest's top corner.
 * The seat faces local +Z.
 */
const HALF_WIDTH = 0.23;
const FRONT = { y: 0.3, z: 0.2 };
const BACK_TOP = { y: 0.66, z: -0.24 };
const HUB_Y = 0.11;
// Hubs sit toward the back so the back arms run behind the fabric, not across it
const HUB_Z = -0.12;

/** Side profile of the sagging fabric, front edge -> seat -> backrest top (y, z). */
const PROFILE = [
  [FRONT.y, FRONT.z],
  [0.25, 0.09],
  [0.22, -0.03],
  [0.27, -0.14],
  [0.45, -0.2],
  [BACK_TOP.y, BACK_TOP.z],
];

const buildSeatGeometry = () => {
  const curve = new THREE.CatmullRomCurve3(PROFILE.map(([y, z]) => new THREE.Vector3(0, y, z)));
  const along = 24;
  const across = 10;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= along; i++) {
    const p = curve.getPointAt(i / along);
    for (let j = 0; j <= across; j++) {
      const u = (j / across) * 2 - 1;
      // Fabric sags between the side edges
      const sag = (1 - u * u) * 0.03;
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

const CampChair = () => {
  const seat = useMemo(buildSeatGeometry, []);
  const { position, rotationY } = LAYOUT.chair;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HALF_WIDTH, 0.14, 0.2]} position={[0, 0.14, 0]} />
        <CuboidCollider args={[HALF_WIDTH, 0.18, 0.03]} position={[0, 0.46, -0.22]} rotation={[-0.2, 0, 0]} />
      </RigidBody>

      {/* Grey mesh fabric bucket with darker binding along the edges */}
      <mesh geometry={seat} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3c40" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * HALF_WIDTH * 0.99, 0.27, 0.03]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.012, 0.012, 0.32]} />
          <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
        </mesh>
      ))}

      {/* Crossbar between the two hubs */}
      <Pole from={[-0.13, HUB_Y, HUB_Z]} to={[0.13, HUB_Y, HUB_Z]} />
      {[-1, 1].map((sx) => {
        const hub = [sx * 0.13, HUB_Y, HUB_Z];
        const frontFoot = [sx * 0.21, 0.012, 0.16];
        const backFoot = [sx * 0.21, 0.012, -0.26];
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
