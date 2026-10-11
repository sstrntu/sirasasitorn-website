import React from 'react';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post-processing:
 *  - N8AO: ambient occlusion that grounds props, plants and roots
 *  - Bloom: fire, lantern, screen and fireflies glow
 *  - ACES tone mapping (the renderer's own is skipped when using a composer)
 *  - Grading: bright, saturated cartoon palette by day (muted at night) with a soft vignette
 */
const Effects = ({ env, quality }) => {
  // Colors fade in moonlight: full saturation by day, muted at night
  const daylight = THREE.MathUtils.smoothstep(env.elevation, -0.25, 0.05);
  const saturation = THREE.MathUtils.lerp(-0.35, 0.15, daylight);
  return (
    <EffectComposer multisampling={quality.multisampling} disableNormalPass>
      {quality.ambientOcclusion ? <N8AO aoRadius={0.8} distanceFalloff={0.6} intensity={0.6} quality="medium" halfRes /> : <></>}
      <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.95} luminanceSmoothing={0.2} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* Bright, saturated adventure-game grade */}
      <BrightnessContrast brightness={0.03} contrast={0.06} />
      <HueSaturation saturation={saturation} />
      <Vignette offset={0.45} darkness={0.2} />
    </EffectComposer>
  );
};

export default Effects;
