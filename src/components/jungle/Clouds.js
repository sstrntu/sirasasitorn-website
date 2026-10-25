import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISLAND } from './sceneConfig';
import { createRandom, randRange } from './utils/geometry';

/*
 * Puffy clouds floating around the island: clusters of soft white blobs
 * with flat bottoms, drifting slowly around the block. A cloudy sky in Krabi
 * (utils/krabiWeather.js) brings in a second ring of them, and greys them all.
 */
const CENTER = (ISLAND.min + ISLAND.max) / 2;
const GREY = new THREE.Color('#9aa3ac');

const buildClouds = (count, seed = 2024, turn = 0) => {
  const rand = createRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + turn + randRange(rand, -0.3, 0.3);
    const radius = randRange(rand, 48, 66);
    const puffs = Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, k) => {
      const s = k === 0 ? randRange(rand, 2.4, 3.3) : randRange(rand, 1.4, 2.4);
      return { position: [randRange(rand, -4.8, 4.8), s * 0.25, randRange(rand, -1.8, 1.8)], scale: s };
    });
    return {
      position: [CENTER + Math.cos(angle) * radius, randRange(rand, 14, 28), CENTER + Math.sin(angle) * radius],
      rotationY: rand() * Math.PI,
      puffs,
    };
  });
};

/** Every puff of every cloud as one instance matrix, cloud after cloud; `ends[i]` counts the puffs of clouds 0..i. */
const buildPuffs = (clouds) => {
  const parent = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const turn = new THREE.Euler();
  const matrices = [];
  const ends = [];
  clouds.forEach((c) => {
    parent.compose(position.set(...c.position), rotation.setFromEuler(turn.set(0, c.rotationY, 0)), scale.set(1, 1, 1));
    c.puffs.forEach((p) => {
      local.compose(position.set(...p.position), rotation.identity(), scale.set(p.scale * 1.25, p.scale * 0.8, p.scale));
      matrices.push(new THREE.Matrix4().multiplyMatrices(parent, local));
    });
    ends.push(matrices.length);
  });
  return { matrices, ends };
};

const Clouds = ({ env, count = 7 }) => {
  // The usual ring, then the extra ring that fills in as the sky clouds over
  const clouds = useMemo(() => [...buildClouds(count), ...buildClouds(count, 2025, Math.PI / count)], [count]);
  const puffs = useMemo(() => buildPuffs(clouds), [clouds]);
  const gloom = env.gloom || 0;
  const shown = count + Math.round(gloom * count);
  const geometry = useMemo(() => {
    // Flattened bottom so each puff sits on a level cloud base
    const g = new THREE.IcosahedronGeometry(1, 4);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(pos.getY(i), -0.35));
    g.computeVertexNormals();
    return g;
  }, []);
  // Clouds catch the light: bright white by day, dimmed and tinted at night, grey when it's overcast
  const color = useMemo(
    () => new THREE.Color('#ffffff').lerp(GREY, gloom * 0.75).lerp(env.backdropTop, env.isNight ? 0.6 : 0.05),
    [env, gloom]
  );
  const ref = useRef();
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.006;
  });
  // All the puffs in one draw call
  const setPuffs = (mesh) => {
    if (!mesh) return;
    puffs.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  };

  return (
    <group ref={ref} position={[CENTER, 0, CENTER]}>
      <group position={[-CENTER, 0, -CENTER]}>
        <instancedMesh
          ref={setPuffs}
          args={[geometry, undefined, puffs.matrices.length]}
          count={puffs.ends[shown - 1]}
          frustumCulled={false}
          raycast={() => null}
        >
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={env.isNight ? 0.02 : 0.3 * (1 - 0.6 * gloom)} roughness={1} />
        </instancedMesh>
      </group>
    </group>
  );
};

export default React.memo(Clouds);
