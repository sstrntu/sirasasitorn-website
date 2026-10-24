import * as THREE from 'three';
import { patchGroundOcclusion } from './groundOcclusion';

/**
 * Calm a scanned (image-to-3D) model's material so it sits with the painted
 * look of the rest of the island: its color and bump textures are read from a
 * blurrier mip level (`bias`), the bumps are shallower (`bumps` scales the
 * normal map) and the surface is fully matte. The scans' crisp pores and
 * cracks otherwise read as grain next to the smooth lawn. Shared materials are
 * only softened once.
 */
export const softenScan = (material, { bias = 1.2, bumps = 0.45 } = {}) => {
  if (material.userData.softened) return material;
  material.userData.softened = true;
  material.roughness = 1;
  if (material.normalScale) material.normalScale.multiplyScalar(bumps);
  const biasUniform = { value: bias };
  material.onBeforeCompile = (shader) => {
    patchGroundOcclusion(shader);
    shader.uniforms.uScanBias = biasUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uScanBias;')
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv, uScanBias )'))
      .replace(
        '#include <normal_fragment_maps>',
        // Both the object- and tangent-space branches sample it
        THREE.ShaderChunk.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('texture2D( normalMap, vNormalMapUv, uScanBias )')
      );
  };
  material.customProgramCacheKey = () => 'scan-soft';
  material.needsUpdate = true;
  return material;
};
