import React from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, HueSaturation, N8AO, Vignette, wrapEffect } from '@react-three/postprocessing';
import { GRADE } from './sceneConfig';
import { AgXToneMappingEffect } from './utils/toneMapping';

const AgXToneMapping = wrapEffect(AgXToneMappingEffect);

/**
 * Post-processing:
 *  - N8AO: ambient occlusion that grounds props, plants and roots
 *  - Bloom: fire, lantern, screen and fireflies glow
 *  - AgX tone mapping (the renderer's own is skipped when using a composer)
 *  - Grading: soft, natural color by day (muted further at night) with a gentle vignette
 */
const Effects = ({ env, quality }) => {
  // Colors fade in moonlight: the day grade by day, muted at night
  const daylight = THREE.MathUtils.smoothstep(env.elevation, -0.25, 0.05);
  // Grey weather (utils/krabiWeather.js) mutes the colors a little more
  const saturation = THREE.MathUtils.lerp(GRADE.nightSaturation, GRADE.saturation, daylight) - 0.12 * (env.gloom || 0);
  return (
    <EffectComposer multisampling={quality.multisampling} disableNormalPass>
      {quality.ambientOcclusion ? <N8AO aoRadius={0.8} distanceFalloff={0.6} intensity={0.6} quality="medium" halfRes /> : <></>}
      {/* High threshold: only the fire, lantern, screen and fireflies glow, not sunlit surfaces */}
      <Bloom mipmapBlur intensity={GRADE.bloom} luminanceThreshold={1} luminanceSmoothing={0.3} radius={0.65} />
      <AgXToneMapping exposure={GRADE.exposure} />
      <HueSaturation saturation={saturation} />
      <Vignette offset={0.45} darkness={0.2} />
    </EffectComposer>
  );
};

export default Effects;
