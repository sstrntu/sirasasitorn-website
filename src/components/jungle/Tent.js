import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ASSETS, LAYOUT } from './sceneConfig';

/*
 * Ultralight backpacking tent: a realistic 3D model (Higgsfield image-to-3D,
 * optimized with scripts/optimize-glb.py), normalized to height 1 with its
 * base at y = 0. TENT_MODEL sets its real size and which way its door faces.
 */
const TENT_MODEL = {
  // Real-world peak height of a 2-person ultralight tent (m)
  height: 1.05,
  // Extra turn so the open door faces the camp (radians, applied before LAYOUT.tent.rotationY)
  turn: -Math.PI / 2,
};

/**
 * Mummy sleeping bag lying along +X (head at -X): a squashed, tapered
 * capsule with a hood ring at the head end.
 */
const buildSleepingBagGeometry = () => {
  const length = 1.4;
  const geometry = new THREE.CapsuleGeometry(0.5, 1, 8, 24);
  geometry.rotateZ(Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); // -1..1 along the bag
    const t = (x + 1) / 2; // 0 at head, 1 at feet
    const width = THREE.MathUtils.lerp(0.36, 0.2, Math.pow(t, 1.3)) * (t < 0.12 ? 0.85 + t : 1);
    pos.setXYZ(i, (x * length) / 2, Math.max(pos.getY(i), -0.2) * 0.22, pos.getZ(i) * width);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * What's inside the tent, in the model's own frame (door toward +X): a
 * floor so the grass doesn't show through, a sleeping pad, a mummy bag and
 * a pillow. Inner tent spans about x -1.0..0.5, z -0.7..0.6 (model units).
 */
const TentInterior = ({ scale }) => {
  const bag = useMemo(buildSleepingBagGeometry, []);
  const cx = -0.36 * scale;
  const cz = -0.05 * scale;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, cz]} receiveShadow>
        <planeGeometry args={[1.45 * scale, 1.25 * scale]} />
        <meshStandardMaterial color="#3b3e42" roughness={0.9} />
      </mesh>
      {/* Inflatable pad */}
      <mesh position={[cx, 0.035, cz - 0.15]} castShadow receiveShadow>
        <boxGeometry args={[1.42, 0.04, 0.42]} />
        <meshStandardMaterial color="#d8892c" roughness={0.6} />
      </mesh>
      {/* Mummy bag, slightly bunched on the pad */}
      <mesh geometry={bag} position={[cx + 0.02, 0.085, cz - 0.15]} rotation={[0, 0.04, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2d6a8f" roughness={0.75} />
      </mesh>
      {/* Pillow at the head end */}
      <mesh position={[cx - 0.6, 0.1, cz - 0.15]} scale={[0.1, 0.05, 0.16]} castShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#c9ccd0" roughness={0.85} />
      </mesh>
    </group>
  );
};

const Tent = () => {
  const { scene } = useGLTF(ASSETS.tent);
  const { model, size } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Nylon reads as soft matte fabric, not glossy plastic
        o.material.roughness = Math.max(o.material.roughness ?? 0.8, 0.75);
        o.material.metalness = 0;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    return { model: clone, size: box.getSize(new THREE.Vector3()) };
  }, [scene]);
  const s = TENT_MODEL.height / size.y;
  const { position, rotationY } = LAYOUT.tent;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Box collider over the tent's footprint so tossed props bounce off it */}
      <RigidBody type="fixed" colliders={false} rotation={[0, TENT_MODEL.turn, 0]}>
        <CuboidCollider args={[(size.x * s) / 2.2, (TENT_MODEL.height * 0.8) / 2, (size.z * s) / 2.2]} position={[0, (TENT_MODEL.height * 0.8) / 2, 0]} />
      </RigidBody>
      <group rotation={[0, TENT_MODEL.turn, 0]}>
        <primitive object={model} scale={s} />
        <TentInterior scale={s} />
      </group>
    </group>
  );
};

useGLTF.preload(ASSETS.tent);

// Memoized: the scene re-renders when the time of day changes, but this doesn't depend on it
export default React.memo(Tent);
