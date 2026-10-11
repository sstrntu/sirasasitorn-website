import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SceneManager.css';

// Code-split the 3D scene (three.js + Rapier WASM) so other routes stay light
const JungleScene = lazy(() => import('./jungle/JungleScene'));

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
    timerRef.current = setTimeout(() => navigate('/pro'), HANDOFF_MS);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="scene-manager">
      <Suspense fallback={<div className="scene-fallback" />}>
        <JungleScene onEnter={handleEnter} />
      </Suspense>
      {isTransitioning && <div className="screen-handoff" style={{ backgroundImage: "url(/jungle/screen.jpg)" }} aria-hidden="true" />}
    </div>
  );
};

export default SceneManager;
