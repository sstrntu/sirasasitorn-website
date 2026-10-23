import * as THREE from 'three';

/*
 * Shader warm-up: compile every program the scene needs before its first
 * frame, all at once and in parallel, while the loading screen is still up.
 *
 * Without it, three.js compiles each material's shaders the first time it is
 * drawn, one after another, waiting for each to finish. On a first visit
 * nothing is in the GPU's shader cache yet, so the first frame froze the page
 * for seconds (worst on phones).
 *
 * three r153 can't do this by itself (compileAsync arrived in r158): its
 * compile() looks up each new program's uniforms right after linking it,
 * which waits for that program to finish compiling. So while precompiling,
 * new programs hand back an empty uniform list (their materials look the real
 * one up again on first use), every compile is queued at once, and
 * KHR_parallel_shader_compile tells us when they are done without blocking.
 */

const EMPTY_UNIFORMS = { seq: [], map: {} };
const POLL_MS = 16;
// Give up waiting (and just render) if the GPU never reports back
const TIMEOUT_MS = 15000;

const sceneMaterials = (scene) => {
  const materials = new Set();
  scene.traverse((object) => [].concat(object.material || []).forEach((m) => materials.add(m)));
  return materials;
};

/**
 * Create (compile and link) the programs for every material in the scene
 * without waiting for any of them. Returns the programs that were created.
 * `renderTarget`: compile as if drawing into a render target (the
 * post-processing composer's input), which changes the output color space.
 */
const compileWithoutWaiting = (gl, scene, camera, renderTarget) => {
  const programs = gl.info.programs;
  const created = [];
  // three's program cache pushes each new program onto this array (info.programs)
  programs.push = function pushDeferred(...items) {
    items.forEach((program) => {
      created.push([program, program.getUniforms]);
      program.getUniforms = () => EMPTY_UNIFORMS;
    });
    return Array.prototype.push.apply(this, items);
  };
  // Its error check also waits on each program: checkLinkStatus() does it afterwards
  const checkShaderErrors = gl.debug.checkShaderErrors;
  gl.debug.checkShaderErrors = false;
  const previousTarget = gl.getRenderTarget();
  try {
    gl.setRenderTarget(renderTarget);
    gl.compile(scene, camera);
  } finally {
    gl.setRenderTarget(previousTarget);
    gl.debug.checkShaderErrors = checkShaderErrors;
    delete programs.push;
    created.forEach(([program, getUniforms]) => {
      program.getUniforms = getUniforms;
    });
  }
  const fresh = new Set(created.map(([program]) => program));
  // Materials on a new program kept its empty uniform list: drop their
  // current program so the first draw wires up the real uniforms
  sceneMaterials(scene).forEach((material) => {
    const properties = gl.properties.get(material);
    if (fresh.has(properties.currentProgram)) properties.currentProgram = null;
  });
  return [...fresh];
};

/** Textures used by the scene's materials (including uniforms added in onBeforeCompile). */
const sceneTextures = (gl, scene) => {
  const textures = new Set();
  const add = (value) => {
    if (value && value.isTexture && !value.isRenderTargetTexture) textures.add(value);
  };
  sceneMaterials(scene).forEach((material) => {
    Object.values(material).forEach(add);
    const uniforms = gl.properties.get(material).uniforms || material.uniforms || {};
    Object.values(uniforms).forEach((uniform) => add(uniform && uniform.value));
  });
  return [...textures];
};

/** Log programs that failed to compile (three's own check was skipped above). */
const checkLinkStatus = (context, programs) => {
  programs.forEach(({ program, name, vertexShader, fragmentShader }) => {
    if (context.getProgramParameter(program, context.LINK_STATUS)) return;
    console.error(
      `THREE.WebGLProgram: shader error in ${name}`,
      context.getProgramInfoLog(program),
      context.getShaderInfoLog(vertexShader),
      context.getShaderInfoLog(fragmentShader)
    );
  });
};

/**
 * Compile all of the scene's shaders in parallel and upload its textures
 * while the GPU works. Resolves when everything is ready to draw.
 * `offscreen`: the scene is drawn into the post-processing composer's buffer
 * rather than straight to the canvas.
 */
export const warmUpScene = (gl, scene, camera, { offscreen = false } = {}) =>
  new Promise((resolve) => {
    const context = gl.getContext();
    const parallel = context.getExtension('KHR_parallel_shader_compile');
    // Any render target gives the same programs as the composer's own buffer
    const target = offscreen ? new THREE.WebGLRenderTarget(1, 1) : null;
    const programs = compileWithoutWaiting(gl, scene, camera, target);
    target?.dispose();
    const textures = sceneTextures(gl, scene);
    const pending = new Set(parallel ? programs : []);
    const started = performance.now();

    const finish = () => {
      checkLinkStatus(context, programs);
      resolve();
    };
    const step = () => {
      // One texture per step keeps the page (and the loading bar) responsive
      const texture = textures.shift();
      if (texture) gl.initTexture(texture);
      pending.forEach((program) => {
        if (context.getProgramParameter(program.program, parallel.COMPLETION_STATUS_KHR)) pending.delete(program);
      });
      if ((pending.size === 0 && textures.length === 0) || performance.now() - started > TIMEOUT_MS) finish();
      else setTimeout(step, pending.size ? POLL_MS : 0);
    };
    step();
  });
