import React, { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DESKTOP_WALLPAPER, SCENE_SCREEN_IMAGE } from '../data/desktopWallpaper';
import './SceneManager.css';

// Code-split the 3D scene (three.js + Rapier WASM) so other routes stay light
const JungleScene = lazy(() => import('./jungle/JungleScene'));

/** Mirrors the scene's own loader (JungleScene's LoadingOverlay) at its starting progress. */
const SceneFallback = () => (
  <div className="scene-fallback">
    <div className="jungle-loader">
      <div className="jungle-loader-title">Setting up camp…</div>
      <div className="jungle-loader-bar">
        <div className="jungle-loader-fill" style={{ transform: 'scaleX(0.04)' }} />
      </div>
    </div>
  </div>
);

// Matches the duration of the .screen-handoff fade in SceneManager.css
const HANDOFF_MS = 450;

const SceneManager = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Called once the camera has flown into the laptop screen. The screen shows
  // the desktop wallpaper, so fading the same image in full-screen hands off
  // seamlessly to the /pro desktop.
  const handleEnter = () => {
    if (timerRef.current) return;
    setIsTransitioning(true);
    // As a transition, the wallpaper overlay stays up until the desktop has
    // rendered, instead of flashing a blank fallback while its code loads.
    // The desktop fades its icons in when it knows it was entered this way.
    timerRef.current = setTimeout(
      () => startTransition(() => navigate('/pro', { state: { fromScene: true } })),
      HANDOFF_MS
    );
  };

  // Once the scene is up, fetch the desktop wallpaper so it's ready on arrival
  const handleReady = useCallback(() => {
    new Image().src = DESKTOP_WALLPAPER;
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="scene-manager">
      <Suspense fallback={<SceneFallback />}>
        <JungleScene onEnter={handleEnter} onReady={handleReady} />
      </Suspense>
      {isTransitioning && <div className="screen-handoff" style={{ backgroundImage: `url(${SCENE_SCREEN_IMAGE})` }} aria-hidden="true" />}
    </div>
  );
};

export default SceneManager;
