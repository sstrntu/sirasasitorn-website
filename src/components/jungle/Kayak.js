import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { KAYAK } from './sceneConfig';
import { terrainHeight } from './Island';

/*
 * A sit-on-top kayak pulled up on the beach along the shoreline. Built from
 * a lofted hull: pointed at both ends, a flat deck with a recessed seat well.
 */
const LENGTH = 3.0;
const WIDTH = 0.66;
const HULL_COLOR = '#ffb000';
const flat = { roughness: 0.6, flatShading: true };

/** Lofted hull along local +Z (bow): rounded bottom, flat deck, pointed ends. */
const buildHullGeometry = () => {
  const sections = 20;
  const ring = 10;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const z = (t - 0.5) * LENGTH;
    // Pointed at both ends, fullest just behind the middle
    const w = (WIDTH / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.005;
    const deck = 0.3 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.12; // ends sweep up a little
    for (let k = 0; k <= ring; k++) {
      const a = Math.PI + (k / ring) * Math.PI; // half circle under the deck
      positions.push(Math.cos(a) * w, deck * 0.5 + Math.sin(a) * deck * 0.5, z);
    }
  }
  for (let i = 0; i < sections; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * (ring + 1) + k;
      const b = a + ring + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Deck: close the top of each section
  const deckStart = positions.length / 3;
  for (let i = 0; i <= sections; i++) {
    const base = i * (ring + 1);
    positions.push(positions[base * 3], positions[base * 3 + 1], positions[base * 3 + 2]);
    positions.push(positions[(base + ring) * 3], positions[(base + ring) * 3 + 1], positions[(base + ring) * 3 + 2]);
  }
  for (let i = 0; i < sections; i++) {
    const a = deckStart + i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const Kayak = () => {
  const hull = useMemo(buildHullGeometry, []);
  const { position, rotation } = useMemo(() => {
    const [x, z] = KAYAK.position;
    const dx = Math.sin(KAYAK.heading);
    const dz = Math.cos(KAYAK.heading);
    const bow = terrainHeight(x + dx * LENGTH * 0.45, z + dz * LENGTH * 0.45);
    const stern = terrainHeight(x - dx * LENGTH * 0.45, z - dz * LENGTH * 0.45);
    // Rest on the sloping sand: pitch to follow the beach
    const pitch = Math.atan2(stern - bow, LENGTH * 0.9);
    return { position: [x, Math.max(bow, stern) - 0.04, z], rotation: [pitch, KAYAK.heading, 0.04] };
  }, []);

  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
      <CuboidCollider args={[WIDTH / 2, 0.15, LENGTH / 2.4]} position={[0, 0.15, 0]} />
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial color={HULL_COLOR} side={THREE.DoubleSide} {...flat} />
      </mesh>
      {/* Seat well and backrest */}
      <mesh position={[0, 0.29, -0.1]} receiveShadow>
        <boxGeometry args={[0.42, 0.04, 0.9]} />
        <meshStandardMaterial color="#d97a0f" {...flat} />
      </mesh>
      <mesh position={[0, 0.31, -0.08]}>
        <boxGeometry args={[0.36, 0.03, 0.45]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.42, -0.36]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.36, 0.2, 0.04]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.8} />
      </mesh>
      {/* Bungee cords on the bow deck */}
      {[0.75, 0.95].map((z) => (
        <mesh key={z} position={[0, 0.315, z]}>
          <boxGeometry args={[0.36, 0.012, 0.012]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
    </RigidBody>
  );
};

export default React.memo(Kayak);
