import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { createRandom, randRange } from './utils/geometry';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aPhase;
  attribute float aSpeed;
  varying float vGlow;
  void main() {
    vec3 p = position;
    float t = uTime * aSpeed + aPhase;
    // Lazy looping drift
    p.x += sin(t * 0.7) * 0.6 + sin(t * 1.9) * 0.12;
    p.y += sin(t * 0.9 + 1.3) * 0.35;
    p.z += cos(t * 0.6) * 0.6 + cos(t * 1.7) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Fireflies blink: mostly dim, with short bright pulses
    vGlow = pow(max(sin(uTime * 1.3 * aSpeed + aPhase * 5.0), 0.0), 6.0) * 0.9 + 0.08;
    gl_PointSize = 26.0 * uPixelRatio * vGlow / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float strength = smoothstep(0.5, 0.0, d);
    strength = pow(strength, 2.2);
    gl_FragColor = vec4(vec3(1.6, 2.2, 0.6) * strength * vGlow * 2.5 * uIntensity, strength * uIntensity);
  }
`;

/** Blinking fireflies drifting around the camp and between the plants. */
const Fireflies = ({ count, intensity = 1 }) => {
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const rand = createRandom(404);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = randRange(rand, 1.5, 9);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = randRange(rand, 0.3, 2.6);
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = randRange(rand, 0.4, 1.1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uIntensity: { value: 1 } }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uPixelRatio.value = dpr;
    uniforms.uIntensity.value = intensity;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
};

export default Fireflies;
