import React, { useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { LAYOUT } from './sceneConfig';
import { bucket } from './utils/play';

/** Collapsible camp bucket: about 20 cm tall, origin at the middle of its base. */
export const BUCKET = { height: 0.2, top: 0.11, bottom: 0.09 };
const COLOR = '#4d7385';

/**
 * The bucket's look, shared by the one standing by the fire and the copy Sira
 * carries. `waterRef` gets the water surface (a disc to raise and show as it fills).
 */
export const BucketModel = ({ waterRef }) => (
  <group>
    <mesh position={[0, BUCKET.height / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[BUCKET.top, BUCKET.bottom, BUCKET.height, 18, 1, true]} />
      <meshStandardMaterial color={COLOR} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[BUCKET.bottom, 18]} />
      <meshStandardMaterial color={COLOR} roughness={0.7} />
    </mesh>
    {/* Rolled rim and a wire handle over the top */}
    <mesh position={[0, BUCKET.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[BUCKET.top, 0.006, 6, 24]} />
      <meshStandardMaterial color="#2f4753" roughness={0.6} />
    </mesh>
    <mesh position={[0, BUCKET.height, 0]}>
      <torusGeometry args={[BUCKET.top * 0.98, 0.003, 4, 16, Math.PI]} />
      <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.35} />
    </mesh>
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <circleGeometry args={[BUCKET.top * 0.96, 18]} />
      <meshStandardMaterial color="#5a9cb8" roughness={0.1} transparent opacity={0.85} />
    </mesh>
  </group>
);

/** Sira's bucket by the fire. It isn't there while he's carrying it. */
const Bucket = () => {
  const [carried, setCarried] = useState(bucket.carried);
  useFrame(() => {
    if (carried !== bucket.carried) setCarried(bucket.carried);
  });
  if (carried) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={LAYOUT.bucket.position}>
      <CylinderCollider args={[BUCKET.height / 2, BUCKET.top]} position={[0, BUCKET.height / 2, 0]} />
      <BucketModel />
    </RigidBody>
  );
};

export default React.memo(Bucket);
