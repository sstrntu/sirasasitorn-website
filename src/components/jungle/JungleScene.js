import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useProgress } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import Atmosphere, { EnvironmentMap } from './Atmosphere';
import Island from './Island';
import Karsts from './Karsts';
import Kayak from './Kayak';
import Rocks from './Rocks';
import Clouds from './Clouds';
import Tent from './Tent';
import CampTable from './CampTable';
import CampChair from './CampChair';
import MacBook from './MacBook';
import Campfire from './Campfire';
import Likeness from './Likeness';
import Trees from './Trees';
import Foliage from './Foliage';
import PokeableProps from './PokeableProps';
import CampProps from './CampProps';
import Bucket from './Bucket';
import Fireflies from './Fireflies';
import Bursts from './Bursts';
import PlayHud from './PlayHud';
import Effects from './Effects';
import CameraRig from './CameraRig';
import SceneErrorBoundary from './SceneErrorBoundary';
import DebugPanel, { isDebugMode } from './DebugPanel';
import { CAMERA, GRADE, LAYOUT, getQuality, prefersReducedMotion } from './sceneConfig';
import { updateWind } from './utils/wind';
import { installAgXToneMapping } from './utils/toneMapping';
import { warmUpScene } from './utils/precompile';
import { useTimeOfDay } from './timeOfDay';
import { held } from './utils/play';
import { trackEvent, trackException } from '../../services/analytics';
import './JungleScene.css';

const HINT_DURATION_MS = 10000;

// Phones render without the composer, so the renderer itself tone maps with AgX
installAgXToneMapping();

/**
 * Renderer on an opaque canvas. three r153 always asks for a drawing buffer
 * with an alpha channel, and the anti-aliased leaf edges (alpha-to-coverage)
 * leave partial alpha in it that would let the page show through. The
 * backdrop covers the whole view anyway, so create the context without one.
 */
const createRenderer = (antialias, safe) => (canvas) => {
  // Safe mode asks for the least: no stencil buffer, and whichever GPU the browser prefers
  const attributes = { alpha: false, antialias, depth: true, stencil: !safe, powerPreference: safe ? 'default' : 'high-performance' };
  const context = canvas.getContext('webgl2', attributes) || canvas.getContext('webgl', attributes);
  return new THREE.WebGLRenderer({ canvas, context, antialias, powerPreference: 'high-performance' });
};

/**
 * React Three Fiber re-applies its default ACES tone mapping whenever the
 * canvas is reconfigured (e.g. the adaptive pixel ratio changes); keep AgX.
 */
const KeepAgXToneMapping = () => {
  useFrame(({ gl }) => {
    if (gl.toneMapping !== THREE.CustomToneMapping) gl.toneMapping = THREE.CustomToneMapping;
  });
  return null;
};

/**
 * Shadows are re-rendered every other frame instead of every frame: the sun
 * barely moves and foliage sway still reads smoothly at 30 Hz, so this
 * roughly halves the cost of the shadow passes.
 */
const ShadowThrottle = () => {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    if (frame.current++ % 2 === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
};

const ACTIVE_FPS = 60;
const IDLE_FPS = 30;
const IDLE_AFTER_MS = 3000;

/**
 * Frame governor (the Canvas runs with frameloop="demand"): instead of
 * redrawing at the display's full refresh rate (120 Hz on ProMotion Macs),
 * render at most 60 fps while the visitor interacts or the camera is flying,
 * drop to 30 fps when idle, and stop entirely while the tab is hidden.
 * Keeps laptops and phones cool without freezing the ambient animation.
 */
const FrameGovernor = ({ busy }) => {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const lastInput = useRef(performance.now());
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const el = gl.domElement;
    const poke = () => {
      lastInput.current = performance.now();
    };
    const events = ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove'];
    events.forEach((e) => el.addEventListener(e, poke, { passive: true }));
    window.addEventListener('keydown', poke);

    let raf = 0;
    let lastFrame = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      // Full rate while a prop is held, so it keeps up with the pointer
      const active = busyRef.current || held.size > 0 || now - lastInput.current < IDLE_AFTER_MS;
      const interval = 1000 / (active ? ACTIVE_FPS : IDLE_FPS);
      // Small tolerance so a 60 Hz display isn't rounded down to 30 fps
      if (now - lastFrame >= interval - 2) {
        lastFrame = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => el.removeEventListener(e, poke));
      window.removeEventListener('keydown', poke);
    };
  }, [gl, invalidate]);
  return null;
};

const WindClock = () => {
  useFrame(({ clock }) => updateWind(clock.elapsedTime));
  return null;
};

/** Development only: expose the R3F store for debugging (e.g. `__jungle.get().camera`). */
const DevHooks = () => {
  const get = useThree((s) => s.get);
  const useThreeSet = useThree((s) => s.set);
  // Frame counter for performance checks (window.__jungleFrames)
  useFrame(() => {
    if (process.env.NODE_ENV === 'development') window.__jungleFrames = (window.__jungleFrames || 0) + 1;
  });
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    window.__jungle = { get, set: useThreeSet };
    return () => delete window.__jungle;
  }, [get, useThreeSet]);
  return null;
};

/**
 * Mounted once everything has loaded: compiles every shader (all at once, in
 * parallel) and uploads the textures while the loading screen is still up,
 * then reports ready. The canvas doesn't draw until then, so the first frame
 * no longer freezes the page compiling shaders one by one.
 * `offscreen`: desktop draws the scene into the post-processing composer.
 */
const SceneWarmup = ({ offscreen, onDone }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let active = true;
    // Compile against the tone mapping the frames will use (see KeepAgXToneMapping)
    gl.toneMapping = THREE.CustomToneMapping;
    warmUpScene(gl, scene, camera, { offscreen }).then(() => active && onDone());
    return () => {
      active = false;
    };
  }, [gl, scene, camera, offscreen, onDone]);
  return null;
};

/** Fires once the scene has actually drawn a couple of frames (shaders compiled, view in place). */
const ShownSignal = ({ onShown }) => {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 3) onShown();
  });
  return null;
};

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const LoadingOverlay = ({ ready }) => {
  const { progress } = useProgress();
  return (
    <div className={`jungle-loader ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
      <div className="jungle-loader-title">Setting up camp…</div>
      <div className="jungle-loader-bar">
        <div className="jungle-loader-fill" style={{ transform: `scaleX(${Math.max(progress, 4) / 100})` }} />
      </div>
    </div>
  );
};

/**
 * Home page: a floating "mini world" diorama of a Krabi-style island camp,
 * built entirely in code (React Three Fiber) with Rapier physics. Clicking the MacBook flies the camera into its screen,
 * then `onEnter` is called so the app can route to the desktop.
 *
 * `fromDesktop` (zoomed out of the desktop): instead of the intro, the scene
 * opens on the laptop screen and pulls back out to the camp. The page covers
 * it with the wallpaper until `onShown` reports the first frames are drawn.
 */
const JungleScene = ({ onEnter, onReady, fromDesktop = false, onShown, safeMode = false, onCrash }) => {
  const quality = useMemo(() => getQuality(safeMode), [safeMode]);
  // Phones use the renderer's own MSAA; desktop multisamples in the composer instead (safe mode: neither)
  const createGl = useMemo(() => createRenderer(!quality.postprocessing && !quality.safe, quality.safe), [quality]);
  // Adaptive resolution: drop the pixel density if the device can't hold its frame rate
  const [dpr, setDpr] = useState(quality.dpr[1]);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const webglAvailable = useMemo(hasWebGL, []);
  const { env, hour, isOverridden, setOverride } = useTimeOfDay();
  const debug = useMemo(isDebugMode, []);
  const [ready, setReady] = useState(false);
  // Environment lighting is pre-filtered early, before the scene's shaders compile against it
  const [environmentReady, setEnvironmentReady] = useState(false);
  const handleEnvironmentReady = useCallback(() => setEnvironmentReady(true), []);
  const [phase, setPhase] = useState('intro'); // intro -> explore -> entering
  const [hintVisible, setHintVisible] = useState(false);
  // True while the visitor is scrolling/pinching the camera into the screen
  const [diving, setDiving] = useState(false);
  const laptopRef = useRef();
  const enteredRef = useRef(false);

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  const handleIntroDone = useCallback(() => {
    setPhase((p) => (p === 'intro' ? 'explore' : p));
    setHintVisible(true);
  }, []);
  const handleSelectLaptop = useCallback(() => setPhase('entering'), []);
  // Sira's "Open it" bubble: counted separately, to see whether his hints work
  const handleSiraOpensLaptop = useCallback(() => {
    trackEvent('sira_hint_open', 'island', 'laptop');
    setPhase('entering');
  }, []);
  const handleEntered = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    trackEvent('enter_desktop', 'island', 'laptop');
    onEnter?.();
  }, [onEnter]);

  useEffect(() => {
    if (!hintVisible) return undefined;
    const timer = setTimeout(() => setHintVisible(false), HINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hintVisible]);

  // Without WebGL nothing will ever be drawn: uncover the fallback right away
  useEffect(() => {
    if (webglAvailable) return;
    trackException('3D scene: WebGL unavailable', true);
    onShown?.();
  }, [webglAvailable, onShown]);

  // Keyboard shortcut: Enter opens the laptop
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, button, textarea, select')) return; // e.g. debug controls
      if (e.key === 'Enter' && ready && phase !== 'entering') setPhase('entering');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, phase]);

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  return (
    <div className="jungle-scene">
      <SceneErrorBoundary onEnter={onEnter} onError={onShown} onCrash={onCrash} forceFallback={!webglAvailable}>
        <Canvas
          // Nothing is drawn until the scene has loaded and its shaders are compiled
          frameloop={ready ? 'demand' : 'never'}
          shadows={quality.shadows}
          dpr={dpr}
          camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [60, 60, 60] }}
          gl={createGl}
          onCreated={({ gl }) => {
            // Physically-based light falloff (three's default from r155 onward)
            gl.useLegacyLights = false;
            // AgX (utils/toneMapping.js); desktop applies the same curve in Effects.js
            gl.toneMapping = THREE.CustomToneMapping;
            gl.toneMappingExposure = GRADE.exposure;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <PerformanceMonitor
            // Idle frames are capped at 30 fps, so only treat sustained drops below that as struggling
            bounds={() => [22, 28]}
            flipflops={3}
            onDecline={() => setDpr((d) => Math.max(quality.dpr[0], +(d - 0.25).toFixed(2)))}
            onIncline={() => setDpr((d) => Math.min(quality.dpr[1], +(d + 0.25).toFixed(2)))}
          />
          <ShadowThrottle />
          <KeepAgXToneMapping />
          <FrameGovernor busy={phase !== 'explore' || diving} />
          {/* Own boundary: the small HDR file arrives (and is pre-filtered) while the models download */}
          <Suspense fallback={null}>
            <EnvironmentMap onReady={handleEnvironmentReady} />
          </Suspense>
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]}>
              <Atmosphere quality={quality} env={env} />
              <Island env={env} />
              <Karsts env={env} />
              <Kayak />
              <Rocks quality={quality} env={env} />
              <Tent />
              <CampTable>
                <MacBook
                  ref={laptopRef}
                  // Lid opens slowly while the intro camera flies in to the camp
                  // (already open when coming back out of the desktop)
                  open={ready || fromDesktop}
                  startOpen={fromDesktop}
                  openDelay={reducedMotion ? 0 : CAMERA.intro.hold}
                  openDuration={reducedMotion ? 1.2 : CAMERA.intro.duration}
                  interactive={phase === 'explore' && !diving}
                  showHint={phase === 'explore' && !diving}
                  onSelect={handleSelectLaptop}
                />
              </CampTable>
              <CampChair />
              <Campfire quality={quality} ambient={env.hemiIntensity / 1.35} />
              <Trees quality={quality} />
              <Foliage quality={quality} />
              <PokeableProps />
              <CampProps />
              <Bucket />
              {/* Fetched only once the scene is up, so it doesn't add to the first-visit load */}
              {ready && LAYOUT.likeness.visible && (
                <Suspense fallback={null}>
                  <Likeness interactive={phase === 'explore' && !diving} onSelectLaptop={handleSiraOpensLaptop} hour={hour} />
                </Suspense>
              )}
            </Physics>
            <Bursts />
            {env.fireflies > 0.01 && <Fireflies count={quality.fireflies} intensity={env.fireflies} />}
            <Clouds env={env} />
            <WindClock />
            <CameraRig
              phase={phase}
              laptopRef={laptopRef}
              reducedMotion={reducedMotion}
              startOnScreen={fromDesktop}
              onIntroDone={handleIntroDone}
              onEntered={handleEntered}
              onDiveChange={setDiving}
            />
            {quality.postprocessing && <Effects env={env} quality={quality} />}
            {/* Last, so everything above has set up its materials */}
            {environmentReady && <SceneWarmup offscreen={quality.postprocessing} onDone={handleReady} />}
            {onShown && <ShownSignal onShown={onShown} />}
            <DevHooks />
          </Suspense>
        </Canvas>

        {/* Coming back from the desktop, the page shows the wallpaper while loading instead */}
        {!fromDesktop && <LoadingOverlay ready={ready} />}

        <div className={`jungle-hint ${hintVisible && phase === 'explore' && !diving ? 'is-visible' : ''}`} role="status">
          <div className="jungle-hint-title">
            {quality.mobile ? 'Pinch into the MacBook to enter' : 'Scroll into the MacBook to enter'}
          </div>
          <div className="jungle-hint-sub">
            Drag to spin the island · tap and toss things to find what they do
          </div>
        </div>

        <PlayHud visible={ready && phase === 'explore' && !diving} />

        {debug && <DebugPanel hour={hour} isOverridden={isOverridden} setOverride={setOverride} />}

        {ready && phase !== 'entering' && !diving && (
          <button type="button" className="jungle-button jungle-skip" onClick={() => setPhase('entering')}>
            Enter desktop <span aria-hidden="true">→</span>
          </button>
        )}
      </SceneErrorBoundary>
    </div>
  );
};

export default JungleScene;
