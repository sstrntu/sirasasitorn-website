import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISLAND } from './sceneConfig';
import { weatherNow } from './utils/krabiWeather';
import { disturbWaves, isOverWater } from './utils/waves';

/*
 * Rain over the island block (Krabi's live weather, utils/krabiWeather.js):
 * thin streaks falling through a box over the whole block, slanting with the
 * wind and fading out near the camera. One instanced mesh; the vertex shader
 * moves the drops (no per-frame work on the CPU) and shows `uRain` of them, so
 * it's mounted all the time and compiled with the rest of the scene.
 * Raindrops also dimple the sea through the wave simulation.
 */
const TOP = 14;
const BOTTOM = -0.5;
const INSET = 0.3;
const FALL_SPEED = 7.5; // m/s
const STREAK = 0.45; // m
/** Streak width per meter from the camera: about a pixel and a half wherever it is. */
const WIDTH_PER_METER = 0.0011;
/** Sea ripples per second in the heaviest rain. */
const RIPPLES = 36;

const vertexShader = /* glsl */ `
  attribute vec4 aDrop; // x, z across the box (0..1), phase, which rain strength shows it
  uniform float uTime;
  uniform float uRain;
  uniform vec2 uDrift;
  uniform vec3 uMin;
  uniform vec3 uSize;
  varying float vAlpha;
  varying float vAcross;
  void main() {
    float speed = ${FALL_SPEED.toFixed(2)} * (0.85 + 0.3 * fract(aDrop.w * 7.13));
    float fallen = mod(uTime * speed + aDrop.z * uSize.y, uSize.y);
    vec3 dir = normalize(vec3(uDrift.x, -speed, uDrift.y));
    // From the top of the box down, carried sideways by the wind (wrapping inside the box)
    vec3 head = vec3(aDrop.x * uSize.x, uSize.y - fallen, aDrop.y * uSize.z);
    head.xz = mod(head.xz + uDrift * (fallen / speed), uSize.xz);
    head += uMin;
    float distance = length(cameraPosition - head);
    vec3 side = normalize(cross(dir, normalize(cameraPosition - head)));
    vec3 world = head + side * position.x * distance * ${WIDTH_PER_METER.toFixed(5)} - dir * position.y * ${STREAK.toFixed(2)};
    float shown = step(aDrop.w, uRain);
    // Faint near the camera (no huge streaks across the view), fading in at the top, tail fading out
    vAlpha = smoothstep(1.5, 5.0, distance) * smoothstep(0.0, 1.0, fallen) * (1.0 - 0.75 * position.y);
    vAcross = position.x * 2.0;
    gl_Position = shown > 0.5 ? projectionMatrix * viewMatrix * vec4(world, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vAcross;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * (1.0 - vAcross * vAcross) * uOpacity);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

const buildGeometry = (count) => {
  const geometry = new THREE.InstancedBufferGeometry();
  // One streak: x across (-0.5..0.5), y from the drop back along its tail (0..1)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  const drops = new Float32Array(count * 4);
  for (let i = 0; i < drops.length; i++) drops[i] = Math.random();
  geometry.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drops, 4));
  geometry.instanceCount = count;
  return geometry;
};

const Rain = ({ quality, env }) => {
  const count = quality.mobile ? 2500 : 6000;
  const geometry = useMemo(() => buildGeometry(count), [count]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRain: { value: 0 },
      uDrift: { value: new THREE.Vector2() },
      uMin: { value: new THREE.Vector3(ISLAND.min + INSET, BOTTOM, ISLAND.min + INSET) },
      uSize: { value: new THREE.Vector3(ISLAND.max - ISLAND.min - INSET * 2, TOP - BOTTOM, ISLAND.max - ISLAND.min - INSET * 2) },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: quality.mobile ? 0.8 : 0.7 },
    }),
    [quality.mobile]
  );
  const ripples = useRef(0);

  // Pale streaks by day, dim at night
  useEffect(() => {
    const light = THREE.MathUtils.clamp(env.hemiIntensity * 0.7 + env.keyIntensity * 0.1, 0.2, 1.1);
    uniforms.uColor.value.setRGB(0.86, 0.9, 0.95).multiplyScalar(light);
  }, [env, uniforms]);

  useFrame(({ clock }, delta) => {
    const rain = weatherNow.rain;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uRain.value = rain;
    // Blown slightly sideways: a steady slant that grows with the wind
    const drift = Math.min(weatherNow.wind, 10) * 0.12;
    uniforms.uDrift.value.set(drift * 0.8, drift * 0.6);
    if (rain <= 0.01) return;
    ripples.current += rain * RIPPLES * Math.min(delta, 0.1);
    while (ripples.current >= 1) {
      ripples.current -= 1;
      const x = THREE.MathUtils.randFloat(ISLAND.min, ISLAND.max);
      const z = THREE.MathUtils.randFloat(ISLAND.min, ISLAND.max);
      if (isOverWater(x, z)) disturbWaves(x, z, 0.12, -0.0035);
    }
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={3} raycast={() => null}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

export default React.memo(Rain);
