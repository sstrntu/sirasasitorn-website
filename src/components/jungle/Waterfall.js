import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/*
 * Waterfall as an animated ribbon that follows a path down a rock face.
 * Used on the main karst tower (see Karsts.js). The shader scrolls layered
 * streaks downward, frays the edges and adds foam at the bottom.
 */
const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Ripples travel down the curtain: it sways sideways and billows out a little
    float fall = uv.y * 2.3 + uTime * 5.0;
    p.x += sin(fall) * 0.05 + sin(fall * 0.37 + 1.3) * 0.04;
    p.z += (sin(fall * 0.8 + 0.6) * 0.5 + 0.5) * 0.06;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    // vUv.y is distance up the fall (in 2.5 m units); patterns scroll down fast
    float t = uTime * 2.6;
    float x = vUv.x + (noise(vec2(vUv.y * 2.5 + uTime * 2.0, 3.0)) - 0.5) * 0.18;

    // Long white streaks, broken sheets and quick sparkling droplets
    float streaks = smoothstep(0.5, 0.8, noise(vec2(x * 16.0, vUv.y * 0.7 + t)));
    float sheets = noise(vec2(x * 6.0, vUv.y * 1.6 + t * 1.15));
    float sparkle = smoothstep(0.82, 0.95, noise(vec2(x * 40.0, vUv.y * 9.0 + t * 1.4)));
    float white = clamp(streaks * 0.8 + sheets * 0.45 + sparkle, 0.0, 1.0);

    // Ragged edges, white foam and mist where it hits the pool
    float edgeNoise = (noise(vec2(vUv.y * 4.0 + t, 7.0)) - 0.5) * 0.12;
    float edge = smoothstep(0.0 + edgeNoise, 0.18, x) * smoothstep(1.0 - edgeNoise, 0.82, x);
    float foam = smoothstep(0.45, 0.0, vUv.y);

    vec3 water = vec3(0.32, 0.68, 0.9);
    vec3 col = mix(water, vec3(1.0), clamp(white + foam * 0.8, 0.0, 1.0)) * uLight;
    float alpha = edge * clamp(0.35 + white * 0.65 + foam * 0.4, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

/** Ambient brightness for the unlit water, from the time-of-day lighting. */
const waterLightFrom = (env) => {
  const light = new THREE.Color()
    .copy(env.hemiSky)
    .multiplyScalar(env.hemiIntensity * 0.5)
    .add(env.keyColor.clone().multiplyScalar(env.keyIntensity * 0.14));
  // White water stays mostly neutral; only pick up a hint of the sky tint
  const grey = (light.r + light.g + light.b) / 3;
  return light.lerp(new THREE.Color(grey, grey, grey), 0.6);
};

/** Ribbon geometry along `path` (top to bottom), widening toward the bottom. */
const buildRibbon = (path, width) => {
  const positions = [];
  const uvs = [];
  const indices = [];
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = lengths[lengths.length - 1];
  path.forEach((p, i) => {
    const t = lengths[i] / total;
    const w = (width * (0.7 + t * 0.6)) / 2;
    positions.push(p.x - w, p.y, p.z, p.x + w, p.y, p.z);
    const v = (total - lengths[i]) / 2.5;
    uvs.push(0, v, 1, v);
  });
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
};

export const WaterfallRibbon = ({ path, width = 8, env }) => {
  const geometry = useMemo(() => buildRibbon(path, width), [path, width]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
    }),
    []
  );

  useEffect(() => {
    uniforms.uLight.value.copy(waterLightFrom(env));
  }, [env, uniforms]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry} renderOrder={1} raycast={() => null} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-4}
      />
    </mesh>
  );
};
