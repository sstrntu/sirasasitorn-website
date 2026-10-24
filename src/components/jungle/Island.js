import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { ASSETS, COLORS, GRADE, ISLAND, KARSTS, STREAM, WORLD_SCALE } from './sceneConfig';
import { createRandom, randRange } from './utils/geometry';
import { windUniforms } from './utils/wind';
import { WAVES_GLSL, disturbWaves, initWaves, isOverWater, stepWaves, waveUniforms } from './utils/waves';
import { GROUND, NOT_OCCLUDER, patchGroundOcclusion } from './utils/groundOcclusion';

/*
 * The diorama block: a grassy island top with a sandy beach sloping into a
 * clear turquoise sea, a stream from the waterfall pool, and cut-away sides
 * showing the soil layers (like a slice of the island). Grass, sand and soil
 * use photo textures (ASSETS.ground). It floats over the
 * backdrop with a soft shadow beneath it.
 *
 * Also exports terrain helpers so trees and plants can be placed on it.
 */

const { min: MIN, max: MAX, bottom: BOTTOM, waterLevel: WATER, streamLevel: STREAM_LEVEL } = ISLAND;
const SIZE = MAX - MIN;
const CENTER = (MIN + MAX) / 2;
const GRID = 200;

const smoothstep = THREE.MathUtils.smoothstep;
const STREAM_POINTS = STREAM.path.map(([x, z]) => new THREE.Vector2(x, z));

/** Distance from (x, z) to the stream's center line. */
export const distanceToStream = (x, z) => {
  const p = new THREE.Vector2(x, z);
  let best = Infinity;
  for (let i = 0; i < STREAM_POINTS.length - 1; i++) {
    const a = STREAM_POINTS[i];
    const ab = STREAM_POINTS[i + 1].clone().sub(a);
    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    best = Math.min(best, a.clone().addScaledVector(ab, t).distanceTo(p));
  }
  return best;
};

/** Distance from (x, z) to the waterfall pool's center. */
export const distanceToPool = (x, z) => Math.hypot(x - STREAM.pool.position[0], z - STREAM.pool.position[1]);

/** Coordinate across the shore: grows toward the sea in the front corner, with a wavy coastline. */
export const shoreCoordinate = (x, z) => {
  // Authored at world scale 1, so the beach and sea spread out with the layout
  const u = x / WORLD_SCALE;
  const w = z / WORLD_SCALE;
  return u + w + 1.1 * Math.sin(u * 0.33 - w * 0.29) + 0.6 * Math.sin(w * 0.7);
};

/**
 * True in front of a waterfall: the strip it falls through and lands in.
 * Trees and bushes are kept out so the downpour is never blocked.
 */
export const isInWaterfallPath = (x, z, pad = 0) =>
  KARSTS.some((k) => {
    if (k.waterfallAngle === undefined) return false;
    const dx = x - k.position[0];
    const dz = z - k.position[1];
    const along = dx * Math.cos(k.waterfallAngle) + dz * Math.sin(k.waterfallAngle);
    const across = Math.abs(-dx * Math.sin(k.waterfallAngle) + dz * Math.cos(k.waterfallAngle));
    return along > 0 && along < k.radius + 4.5 + pad && across < 2.2 + pad;
  });

/** Height of the island's top surface at (x, z). */
export const terrainHeight = (x, z) => {
  const s = shoreCoordinate(x, z);
  // Beach slopes into the sea, then the seabed drops off
  // Short beach, then the seabed drops quickly so the water is turquoise right at the shore
  let h = -smoothstep(s, 8.5, 11.2) * 0.5 - smoothstep(s, 10.8, 14.5) * 1.6;
  // Offshore the seabed keeps falling away, so the block's side shows deep ocean
  h -= smoothstep(s, 15, 27) * 3.8;
  // Gentle rolling ground toward the karsts at the back
  const back = smoothstep(-s, 4, 14);
  h += back * (0.35 + 0.35 * Math.sin(x * 0.5) * Math.cos(z * 0.45));
  // Seabed ripples and small undulation on land
  h += Math.sin(x * 1.3 + z * 0.4) * 0.03 + Math.sin(z * 1.1 - x * 0.6) * 0.025;
  // The camp itself is flat
  h *= smoothstep(Math.hypot(x, z), 3.4, 5.0);
  // Stream channel and pool basin
  const streamCut = 1 - smoothstep(distanceToStream(x, z), STREAM.width * 0.45, STREAM.width * 0.95);
  h = THREE.MathUtils.lerp(h, Math.min(h, STREAM_LEVEL - 0.3), streamCut);
  const poolCut = 1 - smoothstep(distanceToPool(x, z), STREAM.pool.radius * 0.7, STREAM.pool.radius * 1.15);
  h = THREE.MathUtils.lerp(h, Math.min(h, STREAM_LEVEL - 0.55), poolCut);
  return h;
};

/** True inside the block's footprint (with an optional inset margin). */
export const isInside = (x, z, margin = 0) => x > MIN + margin && x < MAX - margin && z > MIN + margin && z < MAX - margin;

/** True if (x, z) falls inside a karst tower's footprint (scaled by `pad`). */
export const isInKarst = (x, z, pad = 1.25) => KARSTS.some((k) => Math.hypot(x - k.position[0], z - k.position[1]) < k.radius * pad);

/** True on dry land: above the sea, out of the stream, pool and karsts. */
export const isDryLand = (x, z, margin = 0.5) =>
  isInside(x, z, margin) &&
  terrainHeight(x, z) > WATER + 0.12 &&
  distanceToStream(x, z) > STREAM.width * 0.9 &&
  distanceToPool(x, z) > STREAM.pool.radius * 1.2 &&
  !isInKarst(x, z) &&
  !isInWaterfallPath(x, z);

/** 0 on grass, 1 on sand (beach, sea floor and stream banks). */
export const sandAmount = (x, z) =>
  Math.max(
    smoothstep(shoreCoordinate(x, z), 8.4, 9.4),
    1 - smoothstep(distanceToStream(x, z), STREAM.width * 0.6, STREAM.width * 1.05),
    1 - smoothstep(distanceToPool(x, z), STREAM.pool.radius * 1.0, STREAM.pool.radius * 1.4)
  );

// ---------------------------------------------------------------------------
// Top surface
// ---------------------------------------------------------------------------

// Caustics come from sunlight, so they fade out at night
const causticStrength = { value: 1 };

const createTopMaterial = (grassMap, sandMap) => {
  [grassMap, sandMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
  });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.onBeforeCompile = (shader) => {
    patchGroundOcclusion(shader);
    shader.uniforms.uGrass = { value: grassMap };
    shader.uniforms.uSand = { value: sandMap };
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWaterLevel = { value: WATER };
    shader.uniforms.uCaustics = causticStrength;
    shader.uniforms.uLawn = { value: [COLORS.lawnShade, COLORS.lawn, COLORS.lawnSun].map((c) => new THREE.Color(c)) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTopPos;\nattribute vec2 aGround;\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTopPos = position;\nvGround = aGround;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTopPos;
        varying vec2 vGround;
        uniform sampler2D uGrass;
        uniform sampler2D uSand;
        uniform float uTime;
        uniform float uWaterLevel;
        uniform float uCaustics;
        uniform vec3 uLawn[3];
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 tp = vTopPos.xz;
        // Fine texture detail fades out with distance, so it adds a little realism up
        // close but never turns into grain or shimmer across the lawn
        float closeUp = 1.0 - smoothstep(3.0, 12.0, distance(cameraPosition, vTopPos));
        // Painted lawn: soft patches of shade, mid and sunlit greens
        float patches = tNoise(tp * 0.16) * 0.6 + tNoise(tp * 0.5 + 7.3) * 0.3 + tNoise(tp * 1.6 + 3.1) * 0.1;
        vec3 lawn = mix(uLawn[0], uLawn[1], smoothstep(0.2, 0.5, patches));
        lawn = mix(lawn, uLawn[2], smoothstep(0.55, 0.85, patches));
        // The photo blades only modulate brightness (its average is its smallest mip)
        float bladeLum = dot(texture2D(uGrass, tp * 0.45).rgb, vec3(0.2126, 0.7152, 0.0722));
        float meanLum = dot(texture2D(uGrass, vec2(0.5), 12.0).rgb, vec3(0.2126, 0.7152, 0.0722));
        lawn *= 1.0 + (bladeLum / max(meanLum, 0.01) - 1.0) * 0.4 * closeUp;
        vec3 sandTex = mix(texture2D(uSand, tp * 0.3).rgb, texture2D(uSand, tp * 0.08 + 0.61).rgb, 0.35);
        vec3 sandMean = texture2D(uSand, vec2(0.5), 12.0).rgb;
        sandTex = mix(sandMean, sandTex, 0.35 + 0.65 * closeUp);
        float sandEdge = smoothstep(0.35, 0.65, vGround.x + (tNoise(tp * 2.2) - 0.5) * 0.35);
        vec3 groundTex = mix(lawn, sandTex, sandEdge);
        // Wet sand at the waterline is darker and a touch warmer
        groundTex *= mix(vec3(1.0), vec3(0.72, 0.68, 0.6), vGround.y * sandEdge);
        diffuseColor.rgb *= groundTex;
        // Worn earth around the camp
        float campR = length(tp - vec2(-0.3, 0.1)) + (tNoise(tp * 1.3) - 0.5) * 0.9;
        vec3 dirt = vec3(0.36, 0.27, 0.18) * (0.9 + (tNoise(tp * 0.8) - 0.5) * 0.12 + (tNoise(tp * 6.0) - 0.5) * 0.12 * closeUp);
        diffuseColor.rgb = mix(diffuseColor.rgb, dirt, (1.0 - smoothstep(1.5, 2.3, campR)) * 0.8);
        // Dancing caustics on the sea floor, fading with depth
        float depth = uWaterLevel - vTopPos.y;
        if (depth > 0.0) {
          vec2 cp = tp * 2.6 + vec2(tNoise(tp * 0.7), tNoise(tp * 0.7 + 3.1)) * 2.0;
          float c1 = abs(sin(cp.x + uTime * 0.9 + sin(cp.y * 1.3 + uTime * 0.7)));
          float c2 = abs(sin(cp.y * 1.1 - uTime * 0.8 + sin(cp.x * 1.2 - uTime * 0.6)));
          float caustic = pow(1.0 - min(c1, c2), 8.0);
          diffuseColor.rgb += vec3(0.25, 0.32, 0.3) * caustic * uCaustics * smoothstep(0.02, 0.2, depth) * (1.0 - smoothstep(0.6, 1.8, depth));
        }`
      );
  };
  material.customProgramCacheKey = () => 'island-top-textured';
  return material;
};

const buildTopGeometry = () => {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, GRID, GRID);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(CENTER, 0, CENTER);
  const pos = geometry.attributes.position;
  // Per-vertex tint multiplied onto the textures, plus [sand amount, wetness]
  const colors = [];
  const ground = [];
  const c = new THREE.Color();
  const shade = new THREE.Color('#8fa070');
  const seabed = new THREE.Color('#e9dcb8');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Jungle floor toward the karsts is shadier
    c.setRGB(1, 1, 1).lerp(shade, smoothstep(-shoreCoordinate(x, z), 6, 16) * 0.6);
    const sandy = sandAmount(x, z);
    const wet = smoothstep(h, WATER + 0.12, WATER - 0.02);
    c.lerp(new THREE.Color(1, 1, 1).lerp(seabed, smoothstep(h, WATER - 0.05, WATER - 0.6)), sandy);
    colors.push(c.r, c.g, c.b);
    ground.push(sandy, wet);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aGround', new THREE.Float32BufferAttribute(ground, 2));
  geometry.computeVertexNormals();
  return geometry;
};

// ---------------------------------------------------------------------------
// Cut-away sides: photo soil cross-section
// ---------------------------------------------------------------------------

/** The four sides as [start, end, outward normal] in the XZ plane. */
const EDGES = [
  [[MIN, MAX], [MAX, MAX], [0, 1]],
  [[MAX, MAX], [MAX, MIN], [1, 0]],
  [[MAX, MIN], [MIN, MIN], [0, -1]],
  [[MIN, MIN], [MIN, MAX], [-1, 0]],
];

/** Soil cross-section material: the photo soil, toned down like the lawn. */
const createSoilMaterial = (soilMap) => {
  const material = new THREE.MeshStandardMaterial({ map: soilMap, roughness: 1 });
  material.onBeforeCompile = (shader) => {
    patchGroundOcclusion(shader);
    shader.uniforms.uSoilSaturation = { value: GRADE.groundSaturation };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSoilSaturation;')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, uSoilSaturation);'
      );
  };
  material.customProgramCacheKey = () => 'island-soil';
  return material;
};

const buildSideGeometry = () => {
  const positions = [];
  const uvs = [];
  // Soil texture: u runs along the perimeter, v from just above the surface (0) down to the bottom (1)
  const TOP_Y = 0.6;
  const v = (y) => (TOP_Y - y) / (TOP_Y - BOTTOM);
  let along = 0;
  EDGES.forEach(([[sx, sz], [ex, ez]]) => {
    for (let i = 0; i < GRID; i++) {
      const ax = sx + ((ex - sx) * i) / GRID;
      const az = sz + ((ez - sz) * i) / GRID;
      const bx = sx + ((ex - sx) * (i + 1)) / GRID;
      const bz = sz + ((ez - sz) * (i + 1)) / GRID;
      const ha = terrainHeight(ax, az);
      const hb = terrainHeight(bx, bz);
      const ua = along / 7;
      const ub = (along + SIZE / GRID) / 7;
      positions.push(ax, BOTTOM, az, bx, BOTTOM, bz, bx, hb, bz, ax, BOTTOM, az, bx, hb, bz, ax, ha, az);
      uvs.push(ua, v(BOTTOM), ub, v(BOTTOM), ub, v(hb), ua, v(BOTTOM), ub, v(hb), ua, v(ha));
      along += SIZE / GRID;
    }
  });
  // Bottom face
  positions.push(MIN, BOTTOM, MIN, MAX, BOTTOM, MIN, MAX, BOTTOM, MAX, MIN, BOTTOM, MIN, MAX, BOTTOM, MAX, MIN, BOTTOM, MAX);
  for (let k = 0; k < 6; k++) uvs.push(0.5, 0.99);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};

// ---------------------------------------------------------------------------
// Water: sea, stream and pool surfaces plus the sea's cut-away sides
// ---------------------------------------------------------------------------

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveScale;
  attribute float aDepth;
  varying float vDepth;
  varying float vWave;
  varying vec3 vWorldPos;
  ${WAVES_GLSL}
  void main() {
    vDepth = aDepth;
    vec3 p = position;
    float free = smoothstep(0.0, 0.25, aDepth); // the shoreline itself stays put
    // Gentle idle swell plus the simulated waves
    float swell = (sin(p.x * 0.9 + uTime * 1.2) + sin(p.z * 1.1 - uTime * 0.9)) * 0.012;
    float wave = waveHeight(p.xz) * uWaveScale;
    p.y += (swell + wave) * free;
    vWave = wave * free;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uFlow;
  uniform float uWaveScale;
  varying float vDepth;
  varying float vWave;
  varying vec3 vWorldPos;
  ${WAVES_GLSL}

  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    if (vDepth <= 0.0) discard;
    vec2 p = vWorldPos.xz;
    // Clear in the shallows, calm teal further out; crests look thicker
    float d = smoothstep(0.0, 1.2, vDepth + vWave * 0.8);
    vec3 col = mix(uShallow, uDeep, d);
    float alpha = mix(0.6, 0.92, smoothstep(0.0, 0.35, vDepth));

    // Smooth surface normal: simulated wave slopes plus fine animated ripples
    vec2 slope = waveSlope(p) * uWaveScale;
    vec2 flow = vec2(uTime * 0.25, uTime * 0.18) * (1.0 + uFlow * 3.0);
    float n1 = wNoise(p * 2.2 + flow);
    float n2 = wNoise(p * 3.7 - flow * 1.3);
    vec3 normal = normalize(vec3(-slope.x * 2.5 + (n1 - 0.5) * 0.15, 1.0, -slope.y * 2.5 + (n2 - 0.5) * 0.15));
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Jelly-like shading: lit wave faces brighten, a soft sheen at grazing angles,
    // and a broad, gentle sun highlight (a tight one sparkles on and off as the view turns)
    float facing = dot(normal, normalize(uSunDir + vec3(0.0, 1.0, 0.0)));
    col *= 0.9 + facing * 0.18;
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    col = mix(col, vec3(0.72, 0.86, 0.92), fresnel * 0.25);
    float glint = pow(max(dot(reflect(-uSunDir, normal), viewDir), 0.0), 24.0);
    col = col * uLight + uSunColor * glint * 0.18;

    // Foam on steep or high crests
    float steep = length(slope);
    float crest = smoothstep(0.35, 0.8, steep + max(vWave, 0.0) * 0.5 + (n1 - 0.5) * 0.1);
    col = mix(col, uLight * 0.95, crest * 0.5);
    alpha = max(alpha, crest * 0.8);

    // Soft foam where the water meets the shore
    float foamLine = 1.0 - smoothstep(0.0, 0.12 + n1 * 0.06 + abs(vWave) * 0.4, vDepth);
    float foamPulse = 0.55 + 0.35 * sin(uTime * 1.6 + p.x * 0.8 + p.y * 0.8);
    col = mix(col, uLight * 0.95, foamLine * foamPulse);
    alpha = max(alpha, foamLine * foamPulse * 0.85);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

const sideWaterFragmentShader = /* glsl */ `
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  varying vec3 vWorldPos;
  varying float vSurface;
  void main() {
    // Lighter just under the (moving) surface, deeper teal below, with a soft
    // pale band along the top like the edge of a jelly block (a thin bright
    // line would flicker at a distance)
    float below = vSurface - vWorldPos.y;
    float t = smoothstep(0.0, 1.6, below);
    // Deeper water darkens toward a muted ocean blue
    float abyss = smoothstep(0.8, 5.0, below);
    vec3 col = mix(mix(uShallow, uDeep, 0.35 + t * 0.65), vec3(0.06, 0.2, 0.32), abyss * 0.85) * uLight;
    float rim = 1.0 - smoothstep(0.0, 0.16, below);
    col = mix(col, uLight * 0.95, rim * 0.45);
    gl_FragColor = vec4(col, 0.55 + t * 0.2 + abyss * 0.15 + rim * 0.15);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

const sideWaterVertexShader = /* glsl */ `
  uniform float uLevel;
  attribute float aDepth;
  attribute float aTop;
  varying vec3 vWorldPos;
  varying float vSurface;
  ${WAVES_GLSL}
  void main() {
    // Top edge rides the simulated waves (bottom vertices stay on the seabed)
    vec3 p = position;
    float surface = uLevel + waveHeight(p.xz) * smoothstep(0.0, 0.25, aDepth);
    if (aTop > 0.5) p.y = surface;
    vSurface = surface;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Plane over the whole block at sea level; depth per vertex drives color and alpha. */
const buildSeaGeometry = () => {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, 90, 90);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(CENTER, WATER, CENTER);
  const pos = geometry.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = WATER - terrainHeight(pos.getX(i), pos.getZ(i));
  geometry.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  return geometry;
};

/** Ribbon along the stream plus a disc for the pool, at stream level. */
const buildStreamGeometry = () => {
  const curve = new THREE.CatmullRomCurve3(STREAM.path.map(([x, z]) => new THREE.Vector3(x, STREAM_LEVEL, z)));
  const segments = 80;
  const across = 6;
  const halfWidth = STREAM.width * 0.75;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (let j = 0; j <= across; j++) {
      const o = (j / across) * 2 - 1;
      positions.push(p.x + side.x * o * halfWidth, STREAM_LEVEL, p.z + side.z * o * halfWidth);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ribbon.setIndex(indices);
  const pool = new THREE.CircleGeometry(STREAM.pool.radius * 1.2, 24, 0, Math.PI * 2);
  pool.rotateX(-Math.PI / 2);
  pool.translate(STREAM.pool.position[0], STREAM_LEVEL + 0.002, STREAM.pool.position[1]);
  pool.deleteAttribute('normal');
  pool.deleteAttribute('uv');
  const geometry = mergeNonIndexed([ribbon, pool]);
  const pos = geometry.attributes.position;
  const depth = new Float32Array(pos.count);
  // Stream water ends where it meets the sea
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    depth[i] = isInside(x, z) && shoreCoordinate(x, z) < 12.2 ? STREAM_LEVEL - terrainHeight(x, z) : 0;
  }
  geometry.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  return geometry;
};

const mergeNonIndexed = (geometries) => {
  const positions = [];
  geometries.forEach((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    positions.push(...flat.attributes.position.array);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

/** Translucent water "walls" where the sea meets the cut-away sides. */
const buildSeaSideGeometry = () => {
  const positions = [];
  const depths = [];
  const tops = [];
  EDGES.forEach(([[sx, sz], [ex, ez]]) => {
    for (let i = 0; i < GRID; i++) {
      const ax = sx + ((ex - sx) * i) / GRID;
      const az = sz + ((ez - sz) * i) / GRID;
      const bx = sx + ((ex - sx) * (i + 1)) / GRID;
      const bz = sz + ((ez - sz) * (i + 1)) / GRID;
      const ha = Math.min(terrainHeight(ax, az), WATER);
      const hb = Math.min(terrainHeight(bx, bz), WATER);
      if (ha >= WATER && hb >= WATER) continue;
      positions.push(ax, ha, az, bx, hb, bz, bx, WATER, bz, ax, ha, az, bx, WATER, bz, ax, WATER, az);
      // Water depth along the edge, and which vertices form the top edge
      depths.push(WATER - ha, WATER - hb, WATER - hb, WATER - ha, WATER - hb, WATER - ha);
      tops.push(0, 0, 1, 0, 1, 1);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('aTop', new THREE.Float32BufferAttribute(tops, 1));
  return geometry;
};

/** Ambient brightness for the unlit water, from the time-of-day lighting. */
const waterLightFrom = (env) =>
  new THREE.Color()
    .copy(env.hemiSky)
    .multiplyScalar(env.hemiIntensity * 0.55)
    .add(env.keyColor.clone().multiplyScalar(env.keyIntensity * 0.16))
    .lerp(new THREE.Color(1, 1, 1).multiplyScalar(0.25 + env.hemiIntensity * 0.4), 0.4);

/**
 * Pointer interaction with the sea: drag across it to stir up waves, click
 * to plop a ripple. Camera controls pause while stirring.
 */
const useStirring = () => {
  const controls = useThree((s) => s.controls);
  const stir = useRef(null);

  // Only react when the water is the first thing under the pointer (not land under it)
  const onWater = (e) => e.intersections[0]?.object === e.eventObject && isOverWater(e.point.x, e.point.z);

  const end = (e) => {
    const s = stir.current;
    if (!s) return;
    stir.current = null;
    if (controls) controls.enabled = true;
    document.body.style.cursor = '';
    // A click without dragging drops a "stone": dent, then rebound ripples
    if (!s.moved) disturbWaves(s.start.x, s.start.z, 0.45, -0.35);
    e?.target?.releasePointerCapture?.(e.pointerId);
  };

  return {
    onPointerDown: (e) => {
      if (!onWater(e)) return;
      e.stopPropagation();
      e.target.setPointerCapture(e.pointerId);
      stir.current = { start: e.point.clone(), last: e.point.clone(), moved: false, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER) };
      if (controls) controls.enabled = false;
      document.body.style.cursor = 'grabbing';
    },
    onPointerMove: (e) => {
      const s = stir.current;
      if (!s) {
        if (onWater(e)) document.body.style.cursor = 'pointer';
        return;
      }
      const point = new THREE.Vector3();
      if (!e.ray.intersectPlane(s.plane, point)) return;
      const dist = point.distanceTo(s.last);
      if (dist < 0.05) return;
      s.moved = s.moved || point.distanceTo(s.start) > 0.2;
      // Push water ahead of the finger: a dent where it is, a bump in front
      const steps = Math.ceil(dist / 0.25);
      const dir = point.clone().sub(s.last).normalize();
      for (let i = 1; i <= steps; i++) {
        const q = s.last.clone().lerp(point, i / steps);
        const strength = Math.min(dist * 0.25, 0.06);
        disturbWaves(q.x, q.z, 0.35, -strength);
        disturbWaves(q.x + dir.x * 0.45, q.z + dir.z * 0.45, 0.35, strength * 0.8);
      }
      s.last.copy(point);
    },
    onPointerOut: () => {
      if (!stir.current) document.body.style.cursor = '';
    },
    onPointerUp: end,
    onLostPointerCapture: () => end(),
  };
};

let wavesReady = false;

const Water = ({ env }) => {
  if (!wavesReady) {
    initWaves(terrainHeight);
    wavesReady = true;
  }
  useFrame((_, delta) => stepWaves(delta));
  const stirHandlers = useStirring();
  const geometries = useMemo(
    () => ({ sea: buildSeaGeometry(), stream: buildStreamGeometry(), sides: buildSeaSideGeometry() }),
    []
  );
  const shared = useMemo(
    () => ({
      uTime: windUniforms.uTime,
      uShallow: { value: new THREE.Color(COLORS.waterShallow) },
      uDeep: { value: new THREE.Color(COLORS.waterDeep) },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      ...waveUniforms,
    }),
    []
  );
  const materials = useMemo(() => {
    const surface = (flow, waveScale) =>
      new THREE.ShaderMaterial({
        uniforms: { ...shared, uFlow: { value: flow }, uWaveScale: { value: waveScale } },
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,
        depthWrite: false,
      });
    return {
      sea: surface(0, 1),
      // The stream and pool sit above sea level; they ripple more gently
      stream: surface(1, 0.5),
      sides: new THREE.ShaderMaterial({
        uniforms: { ...shared, uLevel: { value: WATER } },
        vertexShader: sideWaterVertexShader,
        fragmentShader: sideWaterFragmentShader,
        transparent: true,
        depthWrite: false,
      }),
    };
  }, [shared]);

  useEffect(() => {
    shared.uLight.value.copy(waterLightFrom(env)).multiplyScalar(env.isNight ? 0.7 : 1);
    shared.uSunDir.value.copy(env.keyDirection);
    shared.uSunColor.value.copy(env.keyColor).multiplyScalar(env.isNight ? 0.4 : 1);
  }, [env, shared]);

  return (
    <group>
      <mesh geometry={geometries.sea} material={materials.sea} renderOrder={1} {...stirHandlers} />
      <mesh geometry={geometries.stream} material={materials.stream} renderOrder={1} raycast={() => null} />
      <mesh geometry={geometries.sides} material={materials.sides} renderOrder={2} raycast={() => null} />
    </group>
  );
};

// ---------------------------------------------------------------------------

/** Soft shadow of the floating block on an invisible floor below it. */
const ShadowCatcher = ({ env }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER, BOTTOM - 3, CENTER]} receiveShadow raycast={() => null}>
    <planeGeometry args={[600, 600]} />
    {/* No depth write: keeps ambient occlusion from shading the backdrop */}
    <shadowMaterial transparent depthWrite={false} opacity={env.isNight ? 0.3 : 0.16} />
  </mesh>
);

const DROPLETS = 28;
const RIPPLES = 3;

/**
 * Where the waterfall lands: churning foam, droplets arcing out of the pool
 * and ripple rings spreading across it.
 */
const Splash = () => {
  const foamRef = React.useRef();
  const dropRef = React.useRef();
  const rippleRefs = React.useRef([]);
  const [px, pz] = STREAM.pool.position;
  const [kx, kz] = KARSTS[0].position;
  // Toward the cliff, where the falling water hits the pool
  const dir = new THREE.Vector2(kx - px, kz - pz).normalize();
  const impact = useMemo(() => new THREE.Vector3(px + dir.x * 0.55, STREAM_LEVEL, pz + dir.y * 0.55), [px, pz, dir.x, dir.y]);
  const droplets = useMemo(() => {
    const rand = createRandom(12);
    return Array.from({ length: DROPLETS }, () => {
      const a = rand() * Math.PI * 2;
      const speed = randRange(rand, 0.6, 1.6);
      return { phase: rand(), life: randRange(rand, 0.5, 0.9), vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: randRange(rand, 1.4, 2.6) };
    });
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // The falling water keeps the pool churning, sending ripples down the stream
    disturbWaves(impact.x + Math.sin(t * 7) * 0.2, impact.z + Math.cos(t * 5) * 0.2, 0.3, Math.sin(t * 11) * 0.012);
    foamRef.current.children.forEach((m, i) => {
      m.position.y = 0.08 + Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.14;
      m.scale.setScalar(0.18 + Math.abs(Math.sin(t * 3.3 + i)) * 0.1);
      m.rotation.y = t * (0.5 + i * 0.2);
    });
    droplets.forEach((d, i) => {
      const age = ((t / d.life + d.phase) % 1) * d.life;
      dummy.position.set(d.vx * age, 0.05 + d.vy * age - 4.9 * age * age, d.vz * age);
      dummy.scale.setScalar(dummy.position.y > 0 ? 0.045 * (1 - age / d.life) + 0.01 : 0);
      dummy.updateMatrix();
      dropRef.current.setMatrixAt(i, dummy.matrix);
    });
    dropRef.current.instanceMatrix.needsUpdate = true;
    rippleRefs.current.forEach((ring, i) => {
      const p = (t * 0.6 + i / RIPPLES) % 1;
      ring.scale.setScalar(0.2 + p * 1.2);
      ring.material.opacity = (1 - p) * 0.7;
    });
  });

  return (
    <group position={impact}>
      <group ref={foamRef}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.35, 0, Math.sin(i * 1.3) * 0.35]} raycast={() => null}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#f4fbfc" roughness={0.4} flatShading />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={dropRef} args={[undefined, undefined, DROPLETS]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#eaf9fc" roughness={0.3} />
      </instancedMesh>
      {Array.from({ length: RIPPLES }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => (rippleRefs.current[i] = m)}
          position={[0, 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
          raycast={() => null}
        >
          <ringGeometry args={[0.85, 1, 32]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const Island = ({ env }) => {
  useEffect(() => {
    causticStrength.value = THREE.MathUtils.smoothstep(env.elevation, -0.05, 0.2);
  }, [env]);
  const textures = useTexture({ grass: ASSETS.ground.grass, sand: ASSETS.ground.sand, soil: ASSETS.ground.soil });
  const topGeometry = useMemo(buildTopGeometry, []);
  const topMaterial = useMemo(() => createTopMaterial(textures.grass, textures.sand), [textures]);
  const sideGeometry = useMemo(buildSideGeometry, []);
  const sideMaterial = useMemo(() => createSoilMaterial(textures.soil), [textures]);
  useLayoutEffect(() => {
    textures.soil.colorSpace = THREE.SRGBColorSpace;
    textures.soil.wrapS = THREE.RepeatWrapping;
    textures.soil.anisotropy = 8;
    textures.soil.needsUpdate = true;
  }, [textures]);

  return (
    <group>
      {/* Exact collision with the terrain so tossed props roll down the beach */}
      <RigidBody type="fixed" colliders="trimesh" friction={0.9}>
        <mesh geometry={topGeometry} material={topMaterial} receiveShadow castShadow userData={GROUND} />
      </RigidBody>
      <mesh geometry={sideGeometry} material={sideMaterial} castShadow receiveShadow raycast={() => null} userData={NOT_OCCLUDER} />
      <Water env={env} />
      <Splash />
      <ShadowCatcher env={env} />
    </group>
  );
};

export default React.memo(Island);
