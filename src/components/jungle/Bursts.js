import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { on } from './utils/play';

const POOL = 160;

/**
 * Short-lived particle bursts anywhere in the world: flint sparks, coconut
 * juice, water poured from the mug. Requested with `emitBurst({...})` from
 * utils/play; one pooled instanced mesh draws them all.
 */
const Bursts = () => {
  const meshRef = useRef();
  const particles = useMemo(
    () => Array.from({ length: POOL }, () => ({ alive: false, age: 0, life: 1, size: 0.01, gravity: 9.8, p: new THREE.Vector3(), v: new THREE.Vector3() })),
    []
  );
  const next = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(
    () =>
      on('burst', ({ position, count = 10, color: rgb = [1, 1, 1], speed = 1, up = 1, gravity = 9.8, life = 0.6, size = 0.01, direction }) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        for (let n = 0; n < count; n++) {
          const i = next.current;
          next.current = (i + 1) % POOL;
          const pt = particles[i];
          pt.alive = true;
          pt.age = 0;
          pt.life = life * (0.6 + Math.random() * 0.8);
          pt.size = size * (0.6 + Math.random() * 0.8);
          pt.gravity = gravity;
          pt.p.set(position.x, position.y, position.z);
          pt.v.set((Math.random() - 0.5) * 2, Math.random() * up, (Math.random() - 0.5) * 2).multiplyScalar(speed);
          if (direction) pt.v.add(direction);
          mesh.setColorAt(i, color.setRGB(rgb[0], rgb[1], rgb[2]));
        }
        mesh.instanceColor.needsUpdate = true;
      }),
    [particles, color]
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 1 / 20);
    let any = false;
    particles.forEach((pt, i) => {
      if (!pt.alive) return;
      any = true;
      pt.age += dt;
      if (pt.age >= pt.life) {
        pt.alive = false;
        dummy.scale.setScalar(0);
      } else {
        pt.v.y -= pt.gravity * dt;
        pt.p.addScaledVector(pt.v, dt);
        dummy.position.copy(pt.p);
        dummy.scale.setScalar(pt.size * (1 - pt.age / pt.life));
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    if (any) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(mesh) => {
        meshRef.current = mesh;
        if (!mesh || mesh.instanceColor) return;
        // Start every slot hidden, with a color buffer ready for setColorAt
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < POOL; i++) {
          mesh.setMatrixAt(i, zero);
          mesh.setColorAt(i, new THREE.Color(1, 1, 1));
        }
      }}
      args={[null, null, POOL]}
      frustumCulled={false}
      raycast={() => null}
    >
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

export default Bursts;
