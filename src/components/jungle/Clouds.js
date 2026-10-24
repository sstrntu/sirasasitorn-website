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

const Clouds = ({ env, count = 7 }) => {
  // The usual ring, then the extra ring that fills in as the sky clouds over
  const clouds = useMemo(() => [...buildClouds(count), ...buildClouds(count, 2025, Math.PI / count)], [count]);
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

  return (
    <group ref={ref} position={[CENTER, 0, CENTER]}>
      <group position={[-CENTER, 0, -CENTER]}>
        {clouds.slice(0, shown).map((c, i) => (
          <group key={i} position={c.position} rotation={[0, c.rotationY, 0]}>
            {c.puffs.map((p, k) => (
              <mesh key={k} geometry={geometry} position={p.position} scale={[p.scale * 1.25, p.scale * 0.8, p.scale]} raycast={() => null}>
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={env.isNight ? 0.02 : 0.3 * (1 - 0.6 * gloom)} roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
};

export default React.memo(Clouds);
