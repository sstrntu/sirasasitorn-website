import { patchGroundOcclusion } from './groundOcclusion';

/**
 * Shared wind system.
 *
 * A single set of uniforms drives vertex-shader sway on every foliage material,
 * and `windForceAt` gives the same gust pattern to the physics (falling leaves)
 * so plants and debris move together.
 */

export const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 1 },
};

/** Gust strength over time: a calm baseline with slow, irregular gusts. */
export const gustAt = (t) =>
  0.75 + 0.35 * Math.sin(t * 0.27) * Math.sin(t * 0.11 + 1.3) + 0.15 * Math.sin(t * 0.9);

/** Horizontal wind force direction/magnitude used by physics bodies. */
export const windForceAt = (t, x = 0, z = 0) => {
  const gust = gustAt(t);
  const swirl = Math.sin(t * 1.7 + x * 0.8) * 0.5 + Math.cos(t * 1.3 + z * 0.6) * 0.5;
  return {
    x: (0.6 + swirl * 0.4) * gust,
    z: (0.25 + Math.sin(t * 0.6 + x) * 0.35) * gust,
  };
};

/** Set by the live weather (utils/krabiWeather.js): >1 sways harder in a strong wind. */
export const windWeather = { scale: 1 };

export const updateWind = (t) => {
  windUniforms.uTime.value = t;
  windUniforms.uWindStrength.value = gustAt(t) * windWeather.scale;
};

/**
 * Patch a built-in material (e.g. MeshStandardMaterial) with wind sway.
 *
 * mode 'height': displacement grows with the vertex's local Y (grass, plants).
 * mode 'radial': displacement grows with distance from the local origin
 *                (fronds and leaves attached at their base).
 *
 * Works with InstancedMesh: each instance gets its own phase from its position.
 * Amplitude and frequency are per-material uniforms rather than baked into the
 * shader, so plants that only differ in those share one compiled program.
 */
export const applyWind = (
  material,
  { amplitude = 0.08, frequency = 1.6, mode = 'height', scale = 1 } = {}
) => {
  const s = scale.toFixed(4);
  const amplitudeUniform = { value: amplitude };
  const frequencyUniform = { value: frequency };
  const reach =
    mode === 'radial'
      ? `length(transformed) * ${s}`
      : `max(transformed.y, 0.0) * ${s}`;

  material.onBeforeCompile = (shader) => {
    patchGroundOcclusion(shader);
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uWindAmplitude = amplitudeUniform;
    shader.uniforms.uWindFrequency = frequencyUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uWindStrength;\nuniform float uWindAmplitude;\nuniform float uWindFrequency;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 windOrigin = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          windOrigin += instanceMatrix[3].xyz;
        #endif
        float windPhase = dot(windOrigin.xz, vec2(0.37, 0.61));
        float windReach = ${reach};
        float windSway = sin(uTime * uWindFrequency + windPhase) * 0.65
          + sin(uTime * uWindFrequency * 2.3 + windPhase * 1.7) * 0.25
          + sin(uTime * uWindFrequency * 5.1 + windPhase * 3.1) * 0.1;
        float windAmount = windReach * windReach * uWindAmplitude * uWindStrength;
        transformed.x += windSway * windAmount;
        transformed.z += cos(uTime * uWindFrequency * 0.8 + windPhase) * windAmount * 0.5;
        transformed.y += sin(uTime * uWindFrequency * 3.0 + windPhase * 2.0) * windAmount * 0.15;
        `
      );
  };
  material.customProgramCacheKey = () => `wind-${mode}-${s}`;
  return material;
};
