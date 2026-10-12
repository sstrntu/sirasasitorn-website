import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { createRandom, randRange } from './utils/geometry';
import { lure } from './utils/lure';
import { discover } from './utils/play';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uLure;
  uniform float uLureStrength;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aLured;
  varying float vGlow;
  void main() {
    vec3 p = position;
    float t = uTime * aSpeed + aPhase;
    // Lazy looping drift
    p.x += sin(t * 0.7) * 0.6 + sin(t * 1.9) * 0.12;
    p.y += sin(t * 0.9 + 1.3) * 0.35;
    p.z += cos(t * 0.6) * 0.6 + cos(t * 1.7) * 0.12;
    // Swarm loosely around the carried lantern; eager ones arrive first
    vec3 orbit = vec3(
      sin(t * 1.6 + aPhase * 3.0) * 0.45,
      sin(t * 1.1 + aPhase) * 0.25 + 0.2,
      cos(t * 1.3 + aPhase * 2.0) * 0.45
    ) * (0.5 + aLured * 0.8);
    float pull = clamp(uLureStrength * 1.6 - (1.0 - aLured) * 0.6, 0.0, 1.0) * step(0.35, aLured);
    p = mix(p, uLure + orbit, pull);
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
    const lured = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = randRange(rand, 1.5, 9);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = randRange(rand, 0.3, 2.6);
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = randRange(rand, 0.4, 1.1);
      lured[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    g.setAttribute('aLured', new THREE.BufferAttribute(lured, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uIntensity: { value: 1 },
      uLure: { value: new THREE.Vector3() },
      uLureStrength: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.elapsedTime;
    // Gather slowly, disperse a little faster once the lantern is set down
    const lureStrength = uniforms.uLureStrength;
    lureStrength.value = THREE.MathUtils.damp(lureStrength.value, lure.active ? 1 : 0, lure.active ? 0.9 : 1.4, delta);
    uniforms.uLure.value.copy(lure.position);
    if (lureStrength.value > 0.6) discover('fireflies');
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
