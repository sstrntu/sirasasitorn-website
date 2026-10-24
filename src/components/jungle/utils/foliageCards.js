import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { GRADE } from '../sceneConfig';
import { applyWind } from './wind';
import { createRandom } from './geometry';

/*
 * Realistic foliage from alpha-cutout leaf textures ("cards").
 *
 * A clump is a ball of small textured quads. Their normals are bent
 * outward from the clump's center, so the whole clump shades like a soft
 * leafy ball instead of showing flat planes.
 */

/**
 * Leaf clump of unit radius: `cards` small textured quads spread over a
 * sphere, each facing outward with a random spin. Seen from any angle
 * (including straight down) it reads as a rounded leafy mass, never as a
 * cross of flat planes.
 */
export const createLeafClumpGeometry = (cards = 10, seed = 7) => {
  const rand = createRandom(seed);
  const parts = [];
  const out = new THREE.Vector3();
  const look = new THREE.Matrix4();
  for (let i = 0; i < cards; i++) {
    // Even-ish spread over the sphere (Fibonacci), biased to the upper half
    const y = 1 - ((i + 0.5) / cards) * 1.6;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996 + rand() * 0.6;
    out.set(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    const size = 1.05 + rand() * 0.35;
    const quad = new THREE.PlaneGeometry(size, size);
    quad.rotateZ(rand() * Math.PI * 2);
    // Face outward, tilted a little off the surface so cards overlap softly
    look.lookAt(new THREE.Vector3(), out.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8)), new THREE.Vector3(0, 1, 0));
    quad.applyMatrix4(look);
    quad.translate(out.x * 0.42, out.y * 0.42, out.z * 0.42);
    parts.push(quad);
  }
  const geometry = mergeGeometries(parts);
  // Spherical normals (biased up) so the clump lights like a rounded mass
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i) + 0.35, pos.getZ(i)).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return geometry;
};

/**
 * A palm frond card: a long quad (base at the origin, tip along +Z) bent
 * downward along its length. The texture's frond runs bottom-left to
 * top-right, so UVs are laid diagonally.
 */
export const createFrondCardGeometry = ({ length = 2.2, width = 0.9, segments = 8, droop = 0.9 } = {}) => {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = t * length;
    const y = Math.sin(t * Math.PI * 0.6) * length * 0.16 - droop * t * t * length * 0.5;
    for (let j = 0; j <= 1; j++) {
      const s = j * 2 - 1;
      // Leaflets droop down at the edges a little (a shallow V)
      positions.push(s * width * 0.5, y - width * 0.12, z);
      // Diagonal UVs: base at (0, 0) corner, tip at (1, 1)
      const along = t;
      const across = s * 0.5;
      uvs.push(THREE.MathUtils.clamp(along - across * 0.6, 0, 1), THREE.MathUtils.clamp(along + across * 0.6, 0, 1));
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

// How far each leaf texel is pulled toward the average leaf color (0 = photo as is)
const LEAF_FLATTEN = '0.45';

/** Average color (linear) of a cut-out texture's opaque texels, measured once per texture. */
const averageLeafColor = (map) => {
  if (map.userData.averageColor) return map.userData.averageColor;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(map.image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
    count++;
  }
  const n = Math.max(count, 1) * 255;
  map.userData.averageColor = new THREE.Color().setRGB(sum[0] / n, sum[1] / n, sum[2] / n, THREE.SRGBColorSpace);
  return map.userData.averageColor;
};

/*
 * Anti-aliased cut-outs. A plain alpha test cuts every leaf with a hard
 * stair-step edge that crawls and flickers as the camera moves. With
 * alpha-to-coverage the texture's alpha becomes MSAA coverage instead, so the
 * edge gets a smooth one-pixel ramp: alpha is sharpened around the cutoff by
 * its screen-space rate of change, and boosted on coarser mip levels so
 * distant clumps don't thin out and sparkle. (After Ben Golus, "Anti-aliased
 * Alpha Test: The Esoteric Alpha To Coverage".) Shadows keep the plain alpha test.
 */
const leafAlphaGLSL = /* glsl */ `
#ifdef USE_ALPHATEST
  vec2 leafTexel = vMapUv * uMapSize;
  vec2 leafDx = dFdx(leafTexel);
  vec2 leafDy = dFdy(leafTexel);
  float leafMip = max(0.0, 0.5 * log2(max(dot(leafDx, leafDx), dot(leafDy, leafDy))));
  diffuseColor.a *= 1.0 + leafMip * 0.25;
  diffuseColor.a = clamp((diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 0.0001) + 0.5, 0.0, 1.0);
  if (diffuseColor.a < 0.002) discard;
#endif
`;

// The photo leaves are very saturated and busy: keep only part of their color,
// and pull each texel part of the way to the leaves' average color (tinted per
// instance), so canopies read as soft masses with a hint of leaf pattern
const leafColorGLSL = /* glsl */ `
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, uLeafSaturation);
  #ifdef USE_COLOR
    diffuseColor.rgb = mix(diffuseColor.rgb, uLeafMean * vColor, ${LEAF_FLATTEN});
  #endif
`;

// Leaves deep inside a clump are shaded by the ones around them
const leafDepthGLSL = /* glsl */ `
  diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.3, 0.95, vLeafReach));
`;

// Double-sided materials flip the normal on back faces. For a clump's
// outward (spherical) normals that turns every card seen from behind
// toward the clump's center, so half the leaves render near-black and the
// clump looks busy and harsh. Keep the outward normal on both sides.
const roundNormalGLSL = /* glsl */ `
  normal = normalize(vNormal);
  geometryNormal = normal;
`;

/**
 * Cut-out leaf material with soft (anti-aliased) edges and wind sway;
 * per-instance color tints the texture. `roundShading` is for leaf clumps
 * (createLeafClumpGeometry): both sides of each card use the clump's outward
 * normal, so it lights like one soft, rounded mass.
 */
export const createLeafMaterial = (map, { amplitude = 0.04, frequency = 1.1, roundShading = false } = {}) => {
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const material = applyWind(
    new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.75,
      metalness: 0,
    }),
    { amplitude, frequency, mode: 'radial' }
  );
  // Layer the leaf edge and color patches on top of the wind sway
  const applyWindPatch = material.onBeforeCompile;
  const windKey = material.customProgramCacheKey();
  const averageColor = averageLeafColor(map);
  material.onBeforeCompile = (shader, renderer) => {
    applyWindPatch(shader, renderer);
    shader.uniforms.uMapSize = { value: new THREE.Vector2(map.image.width, map.image.height) };
    shader.uniforms.uLeafSaturation = { value: GRADE.foliageSaturation };
    shader.uniforms.uLeafMean = { value: averageColor };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uMapSize;\nuniform float uLeafSaturation;\nuniform vec3 uLeafMean;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${leafColorGLSL}${roundShading ? leafDepthGLSL : ''}`)
      .replace('#include <alphatest_fragment>', leafAlphaGLSL);
    if (roundShading) {
      // Clump geometry has unit radius: how far out from its center this texel is
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLeafReach;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeafReach = length(position);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLeafReach;')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\n${roundNormalGLSL}`);
    }
  };
  material.customProgramCacheKey = () => `${windKey}-leaf${roundShading ? '-round' : ''}`;
  return material;
};
