import * as THREE from 'three';
import { Effect } from 'postprocessing';
import { GRADE } from '../sceneConfig';

/*
 * AgX tone mapping (three r153 only ships ACES, which pushes saturation and
 * contrast hard). AgX rolls highlights off gently and desaturates them toward
 * white instead of clipping them to neon, so bright greens and turquoise read
 * as soft, natural colors.
 *
 * Port of the AgX approximation used by Filament and three.js r162+
 * (https://github.com/google/filament/pull/7236). Input and output are
 * linear sRGB. Desktop applies it in the post-processing chain
 * (AgXToneMappingEffect); phones skip the composer, so the renderer's
 * CustomToneMapping is pointed at the same curve (installAgXToneMapping).
 */
const AGX_GLSL = /* glsl */ `
  vec3 agxContrastApprox(vec3 x) {
    vec3 x2 = x * x;
    vec3 x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  }

  vec3 agxToneMap(vec3 color) {
    // linear sRGB -> linear Rec.2020 -> AgX inset
    const mat3 srgbToRec2020 = mat3(
      vec3(0.6274, 0.0691, 0.0164),
      vec3(0.3293, 0.9195, 0.0880),
      vec3(0.0433, 0.0113, 0.8956)
    );
    const mat3 rec2020ToSrgb = mat3(
      vec3(1.6605, -0.1246, -0.0182),
      vec3(-0.5876, 1.1329, -0.1006),
      vec3(-0.0728, -0.0083, 1.1187)
    );
    const mat3 inset = mat3(
      vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
      vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
      vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859)
    );
    const mat3 outset = mat3(
      vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
      vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
      vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
    );
    // log2 range around middle grey (0.18): -10 to +6.5 stops
    const float minEv = -12.47393;
    const float maxEv = 4.026069;
    color = inset * (srgbToRec2020 * color);
    color = clamp((log2(max(color, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
    color = outset * agxContrastApprox(color);
    color = pow(max(color, vec3(0.0)), vec3(2.2));
    color = clamp(rec2020ToSrgb * color, 0.0, 1.0);
    // Calm grade shared by phones and desktop: keep only part of the color
    return mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, ${GRADE.toneSaturation.toFixed(3)});
  }
`;

const STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/**
 * Point three's CustomToneMapping at AgX (scaled by renderer.toneMappingExposure).
 * Must run before any material compiles; safe to call more than once.
 */
export const installAgXToneMapping = () => {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (!chunk.includes(STUB)) return;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
    STUB,
    `${AGX_GLSL}\nvec3 CustomToneMapping( vec3 color ) { return agxToneMap( color * toneMappingExposure ); }`
  );
};

const effectShader = /* glsl */ `
  uniform float exposure;
  ${AGX_GLSL}
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = vec4(agxToneMap(inputColor.rgb * exposure), inputColor.a);
  }
`;

/** Post-processing effect: AgX tone mapping (replaces the composer's ACES ToneMapping effect). */
export class AgXToneMappingEffect extends Effect {
  constructor({ exposure = 1 } = {}) {
    super('AgXToneMappingEffect', effectShader, {
      uniforms: new Map([['exposure', new THREE.Uniform(exposure)]]),
    });
  }

  get exposure() {
    return this.uniforms.get('exposure').value;
  }

  set exposure(value) {
    this.uniforms.get('exposure').value = value;
  }
}
