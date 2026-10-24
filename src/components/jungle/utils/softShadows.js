import * as THREE from 'three';
import { KEY_SHADOW } from '../sceneConfig';

/*
 * Soft sun and moon shadows ("percentage-closer soft shadows"): sharp where an
 * object meets the ground, blurring out with distance from it, the way they
 * fall in a pre-rendered scene, instead of the uniformly crisp edge of the
 * standard filter.
 *
 * For each pixel, a search around it in the shadow map finds how far above
 * the surface the shadow casters are; the penumbra widens in proportion and a
 * disk of samples that size averages the shadow. The disk's rotation is tied
 * to the shadow map's own texel grid, so its pattern stays put on surfaces as
 * the camera moves (rotating it per screen pixel would make edges crawl).
 *
 * Patches three's shadow map chunk for directional (and spot) light shadows,
 * so it must run before any shader compiles. The campfire's point-light
 * shadow keeps the standard filter.
 */

// Penumbra width (m) per meter between the caster and the surface: a stylized, soft sun
const SPREAD = 0.05;
// Widest penumbra and blocker search reach (m)
const MAX_BLUR = 0.4;

const glsl = (blockerSamples, filterSamples) => /* glsl */ `
#define PCSS_BLOCKER_SAMPLES ${blockerSamples}
#define PCSS_FILTER_SAMPLES ${filterSamples}
// Shadow depth runs over the light's near..far range; shadow uv over the frustum's width
const float PCSS_SPREAD = ${(SPREAD * (KEY_SHADOW.far - KEY_SHADOW.near)) / (2 * KEY_SHADOW.extent)};
const float PCSS_SEARCH = ${MAX_BLUR / (2 * KEY_SHADOW.extent)};

vec2 pcssDisk(int i, int count, float angle) {
  float r = sqrt((float(i) + 0.5) / float(count));
  float theta = float(i) * 2.3999632 + angle;
  return vec2(cos(theta), sin(theta)) * r;
}

float pcssShadow(sampler2D shadowMap, vec2 shadowMapSize, vec4 coord) {
  float texel = 1.0 / shadowMapSize.x;
  float angle = 6.2831853 * fract(52.9829189 * fract(dot(floor(coord.xy * shadowMapSize), vec2(0.06711056, 0.00583715))));
  float blockerDepth = 0.0;
  float blockers = 0.0;
  for (int i = 0; i < PCSS_BLOCKER_SAMPLES; i++) {
    float depth = unpackRGBAToDepth(texture2D(shadowMap, coord.xy + pcssDisk(i, PCSS_BLOCKER_SAMPLES, angle) * PCSS_SEARCH));
    if (depth < coord.z) {
      blockerDepth += depth;
      blockers += 1.0;
    }
  }
  if (blockers < 0.5) return 1.0;
  blockerDepth /= blockers;
  float radius = clamp((coord.z - blockerDepth) * PCSS_SPREAD, 1.5 * texel, PCSS_SEARCH);
  float lit = 0.0;
  for (int i = 0; i < PCSS_FILTER_SAMPLES; i++) {
    lit += texture2DCompare(shadowMap, coord.xy + pcssDisk(i, PCSS_FILTER_SAMPLES, angle) * radius, coord.z);
  }
  return lit / float(PCSS_FILTER_SAMPLES);
}
`;

/** Install the soft shadow filter. `mobile`: fewer samples per pixel. Safe to call more than once. */
export const installSoftShadows = ({ mobile = false } = {}) => {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes('pcssShadow')) return;
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk
    .replace('float getShadow(', `${mobile ? glsl(8, 12) : glsl(12, 20)}\nfloat getShadow(`)
    .replace('#if defined( SHADOWMAP_TYPE_PCF )', 'return pcssShadow( shadowMap, shadowMapSize, shadowCoord );\n\t\t#if defined( SHADOWMAP_TYPE_PCF )');
};
