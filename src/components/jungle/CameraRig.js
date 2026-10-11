import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { CAMERA } from './sceneConfig';
import { updateSlosh } from './utils/slosh';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Point on a sphere around `target` (azimuth in the XZ plane, elevation above it). */
const orbitPoint = (target, azimuth, elevation, distance) =>
  new THREE.Vector3(
    target.x + Math.cos(azimuth) * Math.cos(elevation) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.sin(azimuth) * Math.cos(elevation) * distance
  );

/** Back off on narrow / portrait screens so the whole block still fits. */
const fitScale = (size) => Math.max(1, 0.85 / (size.width / size.height));

/**
 * Owns the camera choreography:
 *  - intro: opens on the whole floating block, then flies in to the camp
 *  - explore: user orbits and zooms around the laptop with CameraControls
 *  - entering: a curved flight that ends with the laptop screen filling the view
 *
 * During scripted flights the controls are disabled and the camera is driven
 * directly; control is handed back (synced) once a flight completes.
 */
const CameraRig = ({ phase, laptopRef, reducedMotion, onIntroDone, onEntered }) => {
  const controlsRef = useRef();
  const flight = useRef(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const lookTarget = useRef(new THREE.Vector3(...CAMERA.hero.target));

  // Intro flight (runs once)
  useEffect(() => {
    const controls = controlsRef.current;
    controls.enabled = false;
    const heroTarget = new THREE.Vector3(...CAMERA.hero.target);
    const { azimuth, elevation } = CAMERA.hero;
    const distance = CAMERA.hero.distance * fitScale(size);
    const hero = orbitPoint(heroTarget, azimuth, elevation, distance);

    if (reducedMotion) {
      camera.position.copy(hero);
      camera.lookAt(heroTarget);
      lookTarget.current.copy(heroTarget);
      handOverToControls(controls, hero, heroTarget);
      onIntroDone();
      return;
    }

    // Swing in from the overview of the whole block, descending to the camp.
    // Distance shrinks exponentially so the zoom feels even all the way in.
    const intro = CAMERA.intro;
    const startDistance = intro.distance * fitScale(size);
    const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) =>
      orbitPoint(
        heroTarget,
        THREE.MathUtils.lerp(intro.azimuth, azimuth, t),
        THREE.MathUtils.lerp(intro.elevation, elevation, t),
        startDistance * Math.pow(distance / startDistance, t)
      )
    );
    camera.position.copy(points[0]);
    camera.lookAt(heroTarget);
    flight.current = {
      curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      targetFrom: heroTarget.clone(),
      targetTo: heroTarget,
      duration: intro.duration,
      // Negative start = hold on the overview before flying in
      elapsed: -intro.hold,
      ease: easeInOutCubic,
      targetEase: easeInOutSine,
      onDone: () => {
        handOverToControls(controls, hero, heroTarget);
        onIntroDone();
      },
    };
  }, []);

  // Flight into the laptop screen
  useEffect(() => {
    if (phase !== 'entering' || !laptopRef.current) return;
    const controls = controlsRef.current;
    controls.enabled = false;

    const { center, normal, up, width, height } = laptopRef.current.getScreenInfo();
    // Distance at which the screen fills the viewport in both dimensions
    const halfFov = THREE.MathUtils.degToRad(CAMERA.fov) / 2;
    const distForHeight = height / 2 / Math.tan(halfFov);
    const distForWidth = width / 2 / (Math.tan(halfFov) * camera.aspect);
    const finalDistance = Math.min(distForHeight, distForWidth) / CAMERA.enter.screenFill;

    const start = camera.position.clone();
    const approach = center.clone().addScaledVector(normal, 0.85).addScaledVector(up, 0.12);
    const end = center.clone().addScaledVector(normal, finalDistance);
    // Swing up and around so the move reads as one smooth, deliberate flow
    const mid = start.clone().lerp(approach, 0.45).add(new THREE.Vector3(0, 0.35, 0));

    flight.current = {
      curve: new THREE.CatmullRomCurve3([start, mid, approach, end], false, 'centripetal'),
      targetFrom: lookTarget.current.clone(),
      targetTo: center.clone(),
      duration: reducedMotion ? 0.9 : CAMERA.enter.duration,
      elapsed: 0,
      ease: easeInOutCubic,
      targetEase: easeOutCubic,
      onDone: onEntered,
    };
  }, [phase]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const f = flight.current;

    // Near plane scales with the view distance: tight for the screen close-up,
    // wider for the overview so distant geometry keeps depth precision
    const near = THREE.MathUtils.clamp(camera.position.distanceTo(lookTarget.current) * 0.004, CAMERA.near, 0.5);
    if (Math.abs(near - camera.near) > camera.near * 0.1) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    // Spinning or tilting the view sloshes the water
    updateSlosh(camera, lookTarget.current, delta);

    if (!f) {
      // Track the orbit target so the enter flight can start from it
      if (controls.enabled) controls.getTarget(lookTarget.current);
      return;
    }

    controls.enabled = false; // nothing may re-enable controls mid-flight
    f.elapsed += Math.min(delta, 1 / 20);
    const t = THREE.MathUtils.clamp(f.elapsed / f.duration, 0, 1);
    f.curve.getPointAt(f.ease(t), camera.position);
    lookTarget.current.lerpVectors(f.targetFrom, f.targetTo, f.targetEase(t));
    camera.lookAt(lookTarget.current);

    if (t >= 1) {
      flight.current = null;
      f.onDone?.();
    }
  });

  return <CameraControls ref={controlsRef} makeDefault />;
};

function handOverToControls(controls, position, target) {
  const { ACTION } = controls.constructor;
  controls.minDistance = CAMERA.limits.minDistance;
  controls.maxDistance = CAMERA.limits.maxDistance;
  controls.minPolarAngle = CAMERA.limits.minPolarAngle;
  controls.maxPolarAngle = CAMERA.limits.maxPolarAngle;
  controls.smoothTime = 0.35;
  controls.draggingSmoothTime = 0.18;
  controls.azimuthRotateSpeed = 0.6;
  controls.polarRotateSpeed = 0.5;
  // Orbit and zoom only: no panning away from the camp
  controls.mouseButtons.right = ACTION.NONE;
  controls.mouseButtons.middle = ACTION.DOLLY;
  controls.dollySpeed = 0.8;
  controls.touches.two = ACTION.TOUCH_DOLLY;
  controls.touches.three = ACTION.NONE;
  controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, false);
  controls.enabled = true;
}

export default CameraRig;
