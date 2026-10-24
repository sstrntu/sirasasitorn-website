import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { KAYAK } from './sceneConfig';
import { terrainHeight } from './Island';
import { kayak } from './utils/play';

/*
 * A sit-in kayak pulled up on the beach along the shoreline. Built from a
 * lofted hull: pointed at both ends with a little rocker, and a deck with a
 * cockpit (the paddler's legs go under the deck). Sira takes it out now and
 * then: while `kayak.driven` is set it follows the pose in the shared `kayak`
 * state (utils/play), otherwise it rests on the sand.
 */
const LENGTH = 3.0;
const WIDTH = 0.66;
const HULL_COLOR = '#ffb000';
const flat = { roughness: 0.6, flatShading: true };

/** Along the hull (t: 0 stern .. 1 bow): half-width, keel height (rising toward the ends) and deck height. */
const halfWidth = (t) => (WIDTH / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.005;
const keel = (t) => 0.08 * Math.pow(Math.abs(t - 0.5) * 2, 2);
const deck = (t) => 0.28 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.12; // ends sweep up a little
const alongHull = (z) => z / LENGTH + 0.5;

/** The cockpit opening (an ellipse in the deck) and the seat inside it (local, bow along +Z). */
export const COCKPIT = { z: -0.15, halfLength: 0.47, halfWidth: 0.23, seatZ: -0.25, seatY: 0.1 };

/** Lofted hull along local +Z (bow): rounded bottom, open on top (the deck closes it). */
const buildHullGeometry = () => {
  const sections = 24;
  const ring = 10;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const z = (t - 0.5) * LENGTH;
    const w = halfWidth(t);
    const bottom = keel(t);
    const top = deck(t);
    for (let k = 0; k <= ring; k++) {
      const a = Math.PI + (k / ring) * Math.PI; // half ellipse from gunwale to gunwale
      positions.push(Math.cos(a) * w, bottom + (top - bottom) * (1 + Math.sin(a)), z);
    }
  }
  for (let i = 0; i < sections; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * (ring + 1) + k;
      const b = a + ring + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

/** The deck: the hull's outline with the cockpit cut out, following the deck's sweep. */
const buildDeckGeometry = () => {
  const n = 40;
  const outline = [];
  for (let i = 0; i <= n; i++) outline.push(new THREE.Vector2(-halfWidth(i / n), (i / n - 0.5) * LENGTH));
  for (let i = n; i >= 0; i--) outline.push(new THREE.Vector2(halfWidth(i / n), (i / n - 0.5) * LENGTH));
  const shape = new THREE.Shape(outline);
  const hole = new THREE.Path();
  hole.absellipse(0, COCKPIT.z, COCKPIT.halfWidth, COCKPIT.halfLength, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape, 24);
  // Shape (x, z) -> deck (x, height, z)
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getY(i);
    pos.setXYZ(i, pos.getX(i), deck(alongHull(z)), z);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/** Raised rim around the cockpit. */
const buildCoamingGeometry = () => {
  const points = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    const z = COCKPIT.z + Math.sin(a) * COCKPIT.halfLength;
    return new THREE.Vector3(Math.cos(a) * COCKPIT.halfWidth, deck(alongHull(z)) + 0.012, z);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, 0.018, 6, true);
};

const Kayak = () => {
  const hull = useMemo(buildHullGeometry, []);
  const deckGeometry = useMemo(buildDeckGeometry, []);
  const coaming = useMemo(buildCoamingGeometry, []);
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
  const body = useRef();
  const pose = useMemo(() => ({ euler: new THREE.Euler(), quaternion: new THREE.Quaternion(), wasDriven: false }), []);
  useMemo(() => {
    const [px, py, pz] = position;
    kayak.rest = { x: px, y: py, z: pz, pitch: rotation[0], heading: rotation[1], roll: rotation[2] };
  }, [position, rotation]);

  useFrame(() => {
    const rb = body.current;
    if (!rb || (!kayak.driven && !pose.wasDriven)) return;
    // Back on the sand once he's done with it
    const p = kayak.driven ? kayak : kayak.rest;
    pose.wasDriven = kayak.driven;
    rb.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    rb.setNextKinematicRotation(pose.quaternion.setFromEuler(pose.euler.set(p.pitch, p.heading, p.roll)));
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={position} rotation={rotation}>
      <CuboidCollider args={[WIDTH / 2, 0.15, LENGTH / 2.4]} position={[0, 0.15, 0]} />
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial color={HULL_COLOR} side={THREE.DoubleSide} {...flat} />
      </mesh>
      <mesh geometry={deckGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={HULL_COLOR} side={THREE.DoubleSide} {...flat} />
      </mesh>
      <mesh geometry={coaming} castShadow>
        <meshStandardMaterial color="#2b2d31" roughness={0.7} />
      </mesh>
      {/* Seat and backrest down in the cockpit */}
      <mesh position={[0, COCKPIT.seatY - 0.015, COCKPIT.seatZ]} receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.4]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.8} />
      </mesh>
      <mesh position={[0, COCKPIT.seatY + 0.12, COCKPIT.seatZ - 0.24]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.2, 0.04]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.8} />
      </mesh>
      {/* Bungee cords on the bow deck */}
      {[0.75, 0.95].map((z) => (
        <mesh key={z} position={[0, deck(alongHull(z)) + 0.008, z]}>
          <boxGeometry args={[0.36, 0.012, 0.012]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
    </RigidBody>
  );
};

export default React.memo(Kayak);
