import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISLAND, LAYOUT, TABLE } from './sceneConfig';
import { terrainHeight } from './Island';
import { isOverWater, waveHeightAt } from './utils/waves';
import { held } from './utils/play';

/** Height of whatever is right below (x, z) for something at height y: the table top, the sea or the ground. */
const surfaceBelow = (x, z, y) => {
  const [tx, , tz] = LAYOUT.table.position;
  const a = LAYOUT.table.rotationY;
  const dx = x - tx;
  const dz = z - tz;
  const lx = dx * Math.cos(a) - dz * Math.sin(a);
  const lz = dx * Math.sin(a) + dz * Math.cos(a);
  if (y > TABLE.height && Math.abs(lx) < TABLE.width / 2 && Math.abs(lz) < TABLE.depth / 2) return TABLE.height;
  const ground = terrainHeight(x, z);
  return isOverWater(x, z) ? Math.max(ground, ISLAND.waterLevel + waveHeightAt(x, z)) : ground;
};

/** A radial gradient on a small canvas: [stop, rgba] pairs from the centre out. */
const createRadialTexture = (stops) => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

/** A held prop's ring stays at least this many pixels across, so it shows around small props (and above a finger). */
const RING_MIN_PX = 48;

/**
 * While a prop is held: a soft ring around it, so it's clear what's in hand,
 * and its shadow on whatever is below, showing where it will land.
 */
const HoldCue = () => {
  const textures = useMemo(
    () => ({
      ring: createRadialTexture([
        [0, 'rgba(255,255,255,0)'],
        [0.68, 'rgba(255,255,255,0)'],
        [0.8, 'rgba(255,255,255,0.9)'],
        [0.88, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
      shadow: createRadialTexture([
        [0, 'rgba(0,0,0,0.6)'],
        [0.55, 'rgba(0,0,0,0.3)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    }),
    []
  );
  const ring = useRef();
  const shadow = useRef();
  const centre = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size: view, clock }) => {
    const g = [...held].find((h) => h.moved && h.body?.current);
    ring.current.visible = !!g;
    shadow.current.visible = !!g;
    if (!g) return;
    const p = g.body.current.translation();
    centre.set(p.x, p.y + g.size * 0.4, p.z);
    const perPixel = (2 * camera.position.distanceTo(centre) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / view.height;
    const r = Math.max(g.size * 3.2, RING_MIN_PX * perPixel) * (1 + 0.04 * Math.sin(clock.elapsedTime * 3));
    ring.current.position.copy(centre);
    ring.current.scale.set(r, r, 1);
    const below = surfaceBelow(p.x, p.z, p.y);
    const height = Math.max(0, p.y - below);
    const d = g.size * 2.6 * (1 + height * 0.4);
    shadow.current.position.set(p.x, below + 0.006, p.z);
    shadow.current.scale.set(d, d, 1);
    shadow.current.material.opacity = THREE.MathUtils.clamp(1 - height / 2, 0.35, 1) * 0.55;
  });

  return (
    <>
      <sprite ref={ring} visible={false} renderOrder={20}>
        <spriteMaterial map={textures.ring} transparent depthTest={false} depthWrite={false} opacity={0.75} />
      </sprite>
      <mesh ref={shadow} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={textures.shadow} transparent depthWrite={false} opacity={0.55} />
      </mesh>
    </>
  );
};

export default HoldCue;
