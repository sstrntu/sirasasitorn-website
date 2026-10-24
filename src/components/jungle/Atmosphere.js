import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { ASSETS, ISLAND, KEY_SHADOW } from './sceneConfig';

const backdropVertexShader = /* glsl */ `
  uniform mat4 uProjectionInverse;
  uniform mat4 uCameraWorld;
  varying vec3 vWorldDir;
  void main() {
    // Full-screen quad; recover each corner's view direction for stars and moon
    vec4 view = uProjectionInverse * vec4(position.xy, 1.0, 1.0);
    vWorldDir = (uCameraWorld * vec4(view.xyz / view.w, 0.0)).xyz;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const backdropFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uMoonDir;
  uniform float uMoon;
  uniform float uStars;
  uniform float uTime;
  uniform vec2 uViewport;
  varying vec3 vWorldDir;

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    // Screen-space sky gradient (like a backdrop behind a model): deep at the
    // top of the view, pale toward the bottom, whichever way the camera looks
    float screenY = gl_FragCoord.y / uViewport.y;
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, screenY));

    // Stars: sparse hashed points that twinkle, fading toward the bottom
    if (uStars > 0.001) {
      vec3 cell = floor(dir * 220.0);
      float star = hash(cell);
      float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + star * 3.0) + star * 40.0);
      float dotShape = smoothstep(0.32, 0.0, length(fract(dir * 220.0) - 0.5));
      float visible = smoothstep(0.993, 1.0, star) * dotShape * smoothstep(-0.7, -0.1, dir.y);
      col += vec3(0.85, 0.9, 1.0) * visible * twinkle * uStars * 2.2;
    }

    // Moon: soft halo and a bright disc
    float moonAmount = max(dot(dir, uMoonDir), 0.0);
    col += vec3(0.55, 0.62, 0.8) * pow(moonAmount, 60.0) * 0.35 * uMoon;
    col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9994, 0.9997, moonAmount) * 1.6 * uMoon;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

/** Gradient backdrop behind the floating block, with stars and the moon at night. */
const Backdrop = ({ env }) => {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3() },
      uMoon: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uProjectionInverse: { value: new THREE.Matrix4() },
      uCameraWorld: { value: new THREE.Matrix4() },
    }),
    []
  );

  useEffect(() => {
    uniforms.uTop.value.copy(env.backdropTop);
    uniforms.uBottom.value.copy(env.backdropBottom);
    uniforms.uMoonDir.value.copy(env.moonDirection);
    uniforms.uMoon.value = env.moon;
    uniforms.uStars.value = env.stars;
  }, [env, uniforms]);

  useFrame(({ clock, gl, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    gl.getDrawingBufferSize(uniforms.uViewport.value);
    uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  });

  // Drawn first, behind everything, as a full-screen quad
  return (
    <mesh renderOrder={-1000} frustumCulled={false} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={backdropVertexShader}
        fragmentShader={backdropFragmentShader}
      />
    </mesh>
  );
};

/**
 * Image-based lighting from the HDRI, pre-filtered (PMREM) as soon as the
 * small HDR file arrives, while the models are still downloading. Left to
 * three.js it happens on the first frame, and its blur shader is one of the
 * slowest to compile. Mounted in its own Suspense boundary, ahead of the scene.
 */
export const EnvironmentMap = ({ onReady }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const hdri = useLoader(RGBELoader, ASSETS.hdri);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromEquirectangular(hdri);
    pmrem.dispose();
    scene.environment = target.texture;
    onReady?.();
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [gl, scene, hdri, onReady]);
  return null;
};

/**
 * Three r153 has no global environment intensity, so dial the HDRI's
 * contribution per material (`material.userData.envBase` scales it further,
 * e.g. for matte wood).
 */
const EnvironmentIntensity = ({ intensity }) => {
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  useFrame(() => {
    // New objects (e.g. lazily mounted props) are picked up every ~half second
    if (frame.current++ % 30 !== 0) return;
    scene.traverse((obj) => {
      const materials = obj.material ? [].concat(obj.material) : [];
      materials.forEach((m) => {
        if ('envMapIntensity' in m && m.userData.envIntensityApplied !== intensity) {
          m.envMapIntensity = (m.userData.envBase ?? 1) * intensity;
          m.userData.envIntensityApplied = intensity;
        }
      });
    });
  });
  return null;
};

// Shadow-casting light is aimed at the block's center and covers all of it
const SHADOW_TARGET = [(ISLAND.min + ISLAND.max) / 2, 0, (ISLAND.min + ISLAND.max) / 2];
const SHADOW_EXTENT = KEY_SHADOW.extent;

/** Backdrop, environment lighting and the sun/moon key light for the current time of day. */
const Atmosphere = ({ quality, env }) => {
  const scene = useThree((s) => s.scene);
  const keyPosition = useMemo(
    () => env.keyDirection.clone().multiplyScalar(90).add(new THREE.Vector3(...SHADOW_TARGET)),
    [env]
  );
  const [lightTarget] = useState(() => {
    const target = new THREE.Object3D();
    target.position.set(...SHADOW_TARGET);
    return target;
  });

  useEffect(() => {
    scene.background = env.backdropBottom.clone();
  }, [scene, env]);

  return (
    <>
      <Backdrop env={env} />
      <primitive object={lightTarget} />

      {/* Environment lighting: EnvironmentMap above, set up early by JungleScene */}
      <EnvironmentIntensity intensity={Math.round(env.env * 100) / 100} />

      <hemisphereLight color={env.hemiSky} groundColor={env.hemiGround} intensity={env.hemiIntensity} />

      {/* Sun by day, moon by night: the single shadow-casting key light */}
      <directionalLight
        position={keyPosition}
        target={lightTarget}
        color={env.keyColor}
        intensity={env.keyIntensity}
        castShadow
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={KEY_SHADOW.near}
        shadow-camera-far={KEY_SHADOW.far}
        shadow-bias={-0.0003}
        shadow-radius={4}
        shadow-normalBias={quality.shadowNormalBias}
      />

      {/* Soft cool fill from the camera side so faces aren't pitch black */}
      <directionalLight position={[30, 30, 40]} color="#8fa2d4" intensity={env.fill} />
    </>
  );
};

export default Atmosphere;
