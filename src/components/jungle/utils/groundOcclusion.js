import * as THREE from 'three';
import { ISLAND } from '../sceneConfig';

/*
 * Baked sky occlusion ("ambient occlusion") for the island, so the scene gets
 * the soft, grounded shading of a pre-rendered diorama on every device,
 * phones included (they skip the screen-space AO pass).
 *
 * Once everything has loaded, the static scene is rendered from straight
 * above into height maps: the ground, the highest surface and the lowest
 * surface of everything standing on it (trees, rocks, tent, props). For each
 * ground point a pass then measures how much of the sky those surfaces hide,
 * the way a horizon-based AO does on screen, but once and in world space, so
 * it never shimmers as the camera moves. Canopies floating overhead only hide
 * the band of sky they cover, so the ground under a tree is shaded softly
 * rather than blacked out. An island-wide map is backed by a finer one over
 * the camp.
 *
 * Every lit material samples the result by world position: it scales the
 * light bouncing in from the sky and surroundings (and a little of the direct
 * light), fading out with height above the ground. So trunks, rocks, the tent
 * and Sira's feet darken where they meet the ground, and grass and bushes
 * under the trees sit in shade.
 */

// Heights the bake can encode (m): the seabed to above the tallest karst
const Y_MIN = -8;
const Y_MAX = 24;
// Ground heights stored alongside the occlusion for the materials (m)
const GROUND_MIN = -6;
const GROUND_MAX = 3;
// How far out the bake looks for things hiding the sky (m), and how finely:
// directions around each point x steps out along each (phones take fewer)
const RADIUS = 3;
const SAMPLING = { full: { directions: 16, steps: 10 }, light: { directions: 12, steps: 8 } };
const MAP_SIZE = 512;
// Ground covered by something resting on it (a rock, the tent): never seen, but objects
// read it for their bases, which only lose part of their sky there
const UNDER_OBJECT = 0.6;
// Softening of the result (m): rounds off the square leaf cards and the sampling grain
const BLUR = 0.14;
// Fine map over the camp clearing and its props: [center x, center z, size] (m)
const CAMP_REGION = [-0.3, 0.1, 10];

/** Mark a group's meshes as standing on the ground (they cast occlusion). */
export const OCCLUDER = { bake: 'occluder' };
/** Mark the terrain mesh. */
export const GROUND = { bake: 'ground' };
/** Leave a mesh (and its children) out of the bake, e.g. grass tufts that only receive it. */
export const NOT_OCCLUDER = { bake: 'skip' };

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;

/**
 * Shared by every lit material. `uGaoParams`: x = strength on bounced (sky and
 * environment) light, y = strength on direct light, z = height (m) over which
 * the ground's occlusion fades out on objects.
 */
export const groundOcclusionUniforms = {
  uGaoIsland: { value: white },
  uGaoIslandXform: { value: new THREE.Vector4(0, 0.5, 0, 0.5) },
  uGaoCamp: { value: white },
  uGaoCampXform: { value: new THREE.Vector4(0, -1, 0, -1) },
  uGaoParams: { value: new THREE.Vector4(1, 0.3, 0.3, 0) },
};

const f = (n) => n.toFixed(4);

const lookupGLSL = /* glsl */ `
uniform sampler2D uGaoIsland;
uniform vec4 uGaoIslandXform;
uniform sampler2D uGaoCamp;
uniform vec4 uGaoCampXform;
uniform vec4 uGaoParams;
varying vec3 vGaoWorld;
float groundOcclusion() {
  vec2 islandUv = vGaoWorld.xz * uGaoIslandXform.xz + uGaoIslandXform.yw;
  vec2 campUv = vGaoWorld.xz * uGaoCampXform.xz + uGaoCampXform.yw;
  vec2 edge = min(campUv, 1.0 - campUv);
  // The camp's finer map takes over inside its square, blending at the borders
  float inCamp = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  vec4 g = mix(texture2D(uGaoIsland, islandUv), texture2D(uGaoCamp, campUv), inCamp);
  float ground = mix(${f(GROUND_MIN)}, ${f(GROUND_MAX)}, g.g);
  float fade = exp(-abs(vGaoWorld.y - ground) / uGaoParams.z);
  return mix(1.0, g.r, fade);
}
`;

const applyGLSL = /* glsl */ `
#include <aomap_fragment>
{
  float gao = groundOcclusion();
  reflectedLight.indirectDiffuse *= mix(1.0, gao, uGaoParams.x);
  reflectedLight.indirectSpecular *= mix(1.0, gao, uGaoParams.x);
  reflectedLight.directDiffuse *= mix(1.0, gao, uGaoParams.y);
}
`;

const worldGLSL = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 gaoWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    gaoWorld = instanceMatrix * gaoWorld;
  #endif
  vGaoWorld = (modelMatrix * gaoWorld).xyz;
}
`;

/** Add the ground occlusion lookup to a lit built-in material's shader (from onBeforeCompile). */
export const patchGroundOcclusion = (shader) => {
  if (!shader.fragmentShader.includes('#include <aomap_fragment>')) return;
  Object.assign(shader.uniforms, groundOcclusionUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGaoWorld;')
    .replace('#include <worldpos_vertex>', worldGLSL);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${lookupGLSL}`)
    .replace('#include <aomap_fragment>', applyGLSL);
};

/**
 * Give every standard, physical and Lambert material the lookup, including
 * ones created later (lazily loaded props, Sira). Materials with their own
 * onBeforeCompile call patchGroundOcclusion themselves. Run before any compiles.
 */
export const installGroundOcclusion = () => {
  [THREE.MeshStandardMaterial, THREE.MeshLambertMaterial].forEach((type) => {
    if (type.prototype.onBeforeCompile === patchGroundOcclusion) return;
    type.prototype.onBeforeCompile = patchGroundOcclusion;
  });
};

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

const heightVertex = /* glsl */ `
varying float vY;
void main() {
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  p = modelMatrix * p;
  vY = p.y;
  gl_Position = projectionMatrix * viewMatrix * p;
}
`;

// World height packed into two 8-bit channels (~0.5 mm steps); alpha marks "something here"
const heightFragment = /* glsl */ `
varying float vY;
void main() {
  float h = clamp((vY - ${f(Y_MIN)}) / ${f(Y_MAX - Y_MIN)}, 0.0, 1.0) * 255.0;
  gl_FragColor = vec4(floor(h) / 255.0, fract(h), 0.0, 1.0);
}
`;

const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const decodeGLSL = /* glsl */ `
float decodeHeight(vec4 c) {
  return ${f(Y_MIN)} + (c.r * 255.0 + c.g) / 255.0 * ${f(Y_MAX - Y_MIN)};
}
`;

const occlusionFragment = ({ directions, steps }) => /* glsl */ `
uniform sampler2D uGround;
uniform sampler2D uTop;
uniform sampler2D uBottom;
uniform sampler2D uTopWide;
uniform sampler2D uBottomWide;
uniform vec4 uXform;
uniform vec4 uWideXform;
uniform vec3 uRegion; // min x, max z, size
varying vec2 vUv;
${decodeGLSL}

void main() {
  vec4 groundSample = texture2D(uGround, vUv);
  if (groundSample.a < 0.5) {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
  }
  float g = decodeHeight(groundSample);
  float groundOut = clamp((g - ${f(GROUND_MIN)}) / ${f(GROUND_MAX - GROUND_MIN)}, 0.0, 1.0);
  vec4 topHere = texture2D(uTop, vUv);
  vec4 bottomHere = texture2D(uBottom, vUv);
  if (topHere.a > 0.5 && decodeHeight(topHere) - g > 0.05 && bottomHere.a > 0.5 && decodeHeight(bottomHere) - g < 0.12) {
    gl_FragColor = vec4(${f(UNDER_OBJECT)}, groundOut, 0.0, 1.0);
    return;
  }
  vec2 p = vec2(uRegion.x + vUv.x * uRegion.z, uRegion.y - vUv.y * uRegion.z);
  // Interleaved gradient noise turns the direction pattern into fine grain (blurred afterwards)
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float hidden = 0.0;
  for (int d = 0; d < ${directions}; d++) {
    float a = (float(d) + jitter) * ${f((Math.PI * 2) / directions)};
    vec2 dir = vec2(cos(a), sin(a));
    // Union of the sky band hidden along this direction: [lowest bottom, highest top]
    float topMax = 0.0;
    float bottomMin = 1.0;
    float any = 0.0;
    for (int s = 0; s < ${steps}; s++) {
      float t = (float(s) + 0.5) / ${f(steps)};
      float dist = 0.03 + ${f(RADIUS)} * t * t;
      vec2 q = p + dir * dist;
      vec2 uv = q * uXform.xz + uXform.yw;
      vec4 top;
      vec4 bottom;
      if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
        top = texture2D(uTop, uv);
        bottom = texture2D(uBottom, uv);
      } else {
        vec2 wide = q * uWideXform.xz + uWideXform.yw;
        top = texture2D(uTopWide, wide);
        bottom = texture2D(uBottomWide, wide);
      }
      if (top.a < 0.5) continue;
      float rise = decodeHeight(top) - g;
      if (rise < 0.03) continue;
      // Only the ground and things resting on it have no bottom of their own
      float lift = bottom.a < 0.5 ? 0.0 : decodeHeight(bottom) - g;
      lift = lift < 0.12 ? 0.0 : lift;
      topMax = max(topMax, rise * inversesqrt(rise * rise + dist * dist));
      bottomMin = min(bottomMin, lift * inversesqrt(lift * lift + dist * dist));
      any = 1.0;
    }
    // Cosine-weighted share of the sky between those elevations (sin² of each)
    hidden += any * max(0.0, topMax * topMax - bottomMin * bottomMin);
  }
  float visible = 1.0 - hidden / ${f(directions)};
  gl_FragColor = vec4(visible, groundOut, 0.0, 1.0);
}
`;

// One direction of a Gaussian blur of the occlusion (red); the ground height (green) stays sharp
const blurFragment = /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  float sum = 0.0;
  float weight = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-0.5 * float(i * i) / 9.0);
    sum += texture2D(uSource, vUv + float(i) * uStep).r * w;
    weight += w;
  }
  gl_FragColor = vec4(sum / weight, texture2D(uSource, vUv).g, 0.0, 1.0);
}
`;

const BAKE_LAYER = 30;

/** Which meshes go into which pass, from the `userData.bake` marks on their ancestors. */
const collect = (scene) => {
  const ground = [];
  const occluders = [];
  const visit = (object, mode) => {
    if (!object.visible) return;
    const mark = object.userData.bake;
    const here = mark === 'skip' ? 'skip' : mark || mode;
    if (here === 'skip') return;
    const material = object.material;
    const solid =
      (object.isMesh || object.isInstancedMesh) &&
      material &&
      !Array.isArray(material) &&
      material.visible &&
      !material.transparent &&
      material.depthWrite !== false &&
      !material.isShaderMaterial;
    if (solid && here === 'ground') ground.push(object);
    if (solid && here === 'occluder') occluders.push(object);
    object.children.forEach((child) => visit(child, here));
  };
  visit(scene, null);
  return { ground, occluders };
};

const makeTarget = (filter) =>
  new THREE.WebGLRenderTarget(MAP_SIZE, MAP_SIZE, {
    minFilter: filter,
    magFilter: filter,
    generateMipmaps: false,
    depthBuffer: true,
  });

/** Orthographic camera looking straight down on a square region; returns it with the region's world→uv transform. */
const regionCamera = ([cx, cz, size]) => {
  const camera = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0.1, 100);
  camera.position.set(cx, 50, cz);
  camera.up.set(0, 0, -1);
  camera.lookAt(cx, 0, cz);
  camera.updateMatrixWorld();
  camera.layers.set(BAKE_LAYER);
  // Screen right is +x, screen up is -z
  const xform = new THREE.Vector4(1 / size, 0.5 - cx / size, -1 / size, 0.5 + cz / size);
  return { camera, xform, region: new THREE.Vector3(cx - size / 2, cz + size / 2, size) };
};

const ISLAND_REGION = [(ISLAND.min + ISLAND.max) / 2, (ISLAND.min + ISLAND.max) / 2, ISLAND.max - ISLAND.min + 2];

// The current maps, released when the scene is baked again (e.g. coming back from the desktop)
let baked = [];

/** Back to "no occlusion" (white), releasing the maps of a previous bake. */
export const resetGroundOcclusion = () => {
  baked.forEach((target) => target.dispose());
  baked = [];
  groundOcclusionUniforms.uGaoIsland.value = white;
  groundOcclusionUniforms.uGaoCamp.value = white;
  // No camp map: its square lies outside the world, so lookups use the island map
  groundOcclusionUniforms.uGaoCampXform.value.set(0, -1, 0, -1);
};

/**
 * Render the occlusion maps for the static scene and point every material's
 * lookup at them. Call once everything is placed, before the shaders compile.
 * `light`: coarser sampling (phones); `campDetail`: also bake the finer camp map.
 */
export const bakeGroundOcclusion = (gl, scene, { light = false, campDetail = true } = {}) => {
  resetGroundOcclusion();
  const { ground, occluders } = collect(scene);
  if (!ground.length) return;

  const top = new THREE.ShaderMaterial({ vertexShader: heightVertex, fragmentShader: heightFragment, side: THREE.DoubleSide });
  // Lowest surface: keep the farthest fragment from the camera above
  const bottom = top.clone();
  bottom.depthFunc = THREE.GreaterEqualDepth;
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previous = {
    target: gl.getRenderTarget(),
    autoClear: gl.autoClear,
    clearColor: gl.getClearColor(new THREE.Color()),
    clearAlpha: gl.getClearAlpha(),
    background: scene.background,
    override: scene.overrideMaterial,
    shadowAuto: gl.shadowMap.autoUpdate,
    shadowNeedsUpdate: gl.shadowMap.needsUpdate,
  };
  scene.background = null;
  gl.autoClear = false;
  // No shadow maps for these passes (the override materials ignore them anyway)
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = false;
  gl.setClearColor(0x000000, 0);
  const depthBuffer = gl.state.buffers.depth;
  const clear = (depth = 1) => {
    // glClear honors the write masks, which the last draw may have left off
    depthBuffer.setMask(true);
    gl.state.buffers.color.setMask(true);
    depthBuffer.setClear(depth);
    gl.clear(true, true, false);
    depthBuffer.setClear(1);
  };

  const setLayer = (objects, on) => objects.forEach((o) => (on ? o.layers.enable(BAKE_LAYER) : o.layers.disable(BAKE_LAYER)));

  const heightPasses = (view) => {
    const maps = { ground: makeTarget(THREE.NearestFilter), top: makeTarget(THREE.NearestFilter), bottom: makeTarget(THREE.NearestFilter) };
    const pass = (target, objects, material, clearDepth) => {
      setLayer(objects, true);
      scene.overrideMaterial = material;
      gl.setRenderTarget(target);
      clear(clearDepth);
      gl.render(scene, view.camera);
      setLayer(objects, false);
    };
    pass(maps.ground, ground, top, 1);
    // The ground hides the sky too (stream banks, slopes), so it joins the top pass
    pass(maps.top, [...ground, ...occluders], top, 1);
    pass(maps.bottom, occluders, bottom, 0);
    return maps;
  };

  const occlusionPass = (view, maps, wideView, wideMaps) => {
    const raw = makeTarget(THREE.LinearFilter);
    const between = makeTarget(THREE.LinearFilter);
    const result = makeTarget(THREE.LinearFilter);
    quad.material = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: occlusionFragment(light ? SAMPLING.light : SAMPLING.full),
      uniforms: {
        uGround: { value: maps.ground.texture },
        uTop: { value: maps.top.texture },
        uBottom: { value: maps.bottom.texture },
        uTopWide: { value: wideMaps.top.texture },
        uBottomWide: { value: wideMaps.bottom.texture },
        uXform: { value: view.xform },
        uWideXform: { value: wideView.xform },
        uRegion: { value: view.region },
      },
      depthTest: false,
      depthWrite: false,
    });
    gl.setRenderTarget(raw);
    clear();
    gl.render(quadScene, quadCamera);
    quad.material.dispose();
    // Gaussian with a sigma of BLUR meters: 13 taps spaced a third of it apart
    const spacing = BLUR / view.region.z / 3;
    const blur = (source, target, step) => {
      quad.material = new THREE.ShaderMaterial({
        vertexShader: quadVertex,
        fragmentShader: blurFragment,
        uniforms: { uSource: { value: source.texture }, uStep: { value: step } },
        depthTest: false,
        depthWrite: false,
      });
      gl.setRenderTarget(target);
      clear();
      gl.render(quadScene, quadCamera);
      quad.material.dispose();
    };
    blur(raw, between, new THREE.Vector2(spacing, 0));
    blur(between, result, new THREE.Vector2(0, spacing));
    raw.dispose();
    between.dispose();
    return result;
  };

  try {
    const island = regionCamera(ISLAND_REGION);
    const islandMaps = heightPasses(island);
    const islandResult = occlusionPass(island, islandMaps, island, islandMaps);
    groundOcclusionUniforms.uGaoIsland.value = islandResult.texture;
    groundOcclusionUniforms.uGaoIslandXform.value.copy(island.xform);
    baked = [islandResult];
    if (campDetail) {
      const camp = regionCamera(CAMP_REGION);
      const campMaps = heightPasses(camp);
      const campResult = occlusionPass(camp, campMaps, island, islandMaps);
      Object.values(campMaps).forEach((t) => t.dispose());
      baked.push(campResult);
      groundOcclusionUniforms.uGaoCamp.value = campResult.texture;
      groundOcclusionUniforms.uGaoCampXform.value.copy(camp.xform);
    }
    Object.values(islandMaps).forEach((t) => t.dispose());
  } finally {
    top.dispose();
    bottom.dispose();
    quad.geometry.dispose();
    scene.overrideMaterial = previous.override;
    scene.background = previous.background;
    gl.setRenderTarget(previous.target);
    gl.autoClear = previous.autoClear;
    gl.shadowMap.autoUpdate = previous.shadowAuto;
    gl.shadowMap.needsUpdate = previous.shadowNeedsUpdate;
    gl.setClearColor(previous.clearColor, previous.clearAlpha);
  }
};
