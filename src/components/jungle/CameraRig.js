import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { CAMERA, ISLAND, KARSTS } from './sceneConfig';
import { held } from './utils/play';
import { updateSlosh } from './utils/slosh';
import { caveSite } from './utils/caveSite';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Point on a sphere around `target` (azimuth in the XZ plane, elevation above it). */
const orbitPoint = (target, azimuth, elevation, distance) =>
  new THREE.Vector3(
    target.x + Math.cos(azimuth) * Math.cos(elevation) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.sin(azimuth) * Math.cos(elevation) * distance
  );

/** An invisible upright cylinder for the camera to bump into. */
const colliderAt = (x, z, radius, height) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, height + 2, 12));
  mesh.position.set(x, height / 2 - 1, z);
  mesh.updateMatrixWorld(true);
  return mesh;
};

/**
 * Invisible stand-ins for the karst towers and the waterfalls falling in front
 * of them: the camera stops short of them instead of passing through the rock
 * (and the cave inside one) or the falling water as it orbits.
 */
const KARST_COLLIDERS = KARSTS.flatMap((k) => {
  const tower = colliderAt(k.position[0], k.position[1], k.radius * 0.95, k.height);
  if (k.waterfallAngle === undefined) return [tower];
  // Where the waterfall lands (as in sceneConfig STREAM), with room for its spray
  const out = k.radius + 1.1;
  const fall = colliderAt(k.position[0] + Math.cos(k.waterfallAngle) * out, k.position[1] + Math.sin(k.waterfallAngle) * out, 1.8, k.height);
  return [tower, fall];
});

/** Where the orbit point may go: over the island, so panning can't lose it. */
const ORBIT_BOUNDS = new THREE.Box3(new THREE.Vector3(ISLAND.min + 1, -0.5, ISLAND.min + 1), new THREE.Vector3(ISLAND.max - 1, 7, ISLAND.max - 1));

/** Zooming this close to the laptop (its orbit point within this of the screen, m) becomes the dive. */
const DIVE_NEAR_LAPTOP = 1.2;

/** Dive progress per pixel of wheel scroll (a few notches dives all the way in). */
const DIVE_PER_WHEEL_PX = 1 / 650;
/** Dive progress per unit of pinch spread (finger distance ratio - 1). */
const DIVE_PER_PINCH = 2.2;
/** A dive left half-way settles (in or back out) after this long without input (seconds). */
const DIVE_SETTLE_AFTER = 0.65;
/** Zooming in any closer than this (meters from the laptop) becomes the dive. */
const DIVE_START_DISTANCE = 2;

/**
 * Path from the current camera pose into the laptop screen, ending where the
 * screen fills the viewport. Shared by the click-to-enter flight and the
 * scroll/pinch dive. With `frameWallpaper` it ends a little further back
 * instead, where the wallpaper on the screen is framed exactly like the
 * full-page wallpaper ("cover"), so coming back out of the desktop starts
 * without a jump in scale.
 */
const buildScreenPath = (camera, laptop, lookFrom, frameWallpaper = false) => {
  const { center, normal, up, width, height, imageWidth, imageHeight } = laptop.getScreenInfo();
  // Distance at which the screen (or the whole wallpaper) fills the viewport in both dimensions
  const halfFov = THREE.MathUtils.degToRad(CAMERA.fov) / 2;
  const [w, h, fill] = frameWallpaper ? [imageWidth, imageHeight, 1] : [width, height, CAMERA.enter.screenFill];
  const distForHeight = h / 2 / Math.tan(halfFov);
  const distForWidth = w / 2 / (Math.tan(halfFov) * camera.aspect);
  const finalDistance = Math.min(distForHeight, distForWidth) / fill;

  const start = camera.position.clone();
  const approach = center.clone().addScaledVector(normal, 0.85).addScaledVector(up, 0.12);
  const end = center.clone().addScaledVector(normal, finalDistance);
  // Swing up and around so the move reads as one smooth, deliberate flow
  // (less so when starting close in, where a big swing would read as a bob)
  const swing = Math.min(0.35, start.distanceTo(approach) * 0.3);
  const mid = start.clone().lerp(approach, 0.45).add(new THREE.Vector3(0, swing, 0));
  return {
    curve: new THREE.CatmullRomCurve3([start, mid, approach, end], false, 'centripetal'),
    targetFrom: lookFrom.clone(),
    targetTo: center.clone(),
  };
};

/** Where on a path (0–1, by length) it passes closest to `point`. */
const progressNear = (curve, point) => {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= 200; i++) {
    const d = curve.getPointAt(i / 200).distanceToSquared(point);
    if (d < bestDistance) {
      bestDistance = d;
      best = i / 200;
    }
  }
  return best;
};

/**
 * A flight along `points`, looking along `looks`. Passing through the waterfall
 * (`water`) it calls `onWater` and marks the camera inside the cave or not (`inside`).
 */
const caveFlight = (points, looks, water, inside, duration, onWater, onDone) => {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return {
    curve,
    targetCurve: new THREE.CatmullRomCurve3(looks, false, 'centripetal'),
    duration,
    elapsed: 0,
    ease: easeInOutCubic,
    targetEase: easeInOutCubic,
    event: {
      at: progressNear(curve, water),
      fn: () => {
        caveSite.inside = inside;
        onWater?.();
      },
      fired: false,
    },
    onDone,
  };
};

/** Back off on narrow / portrait screens so the whole block still fits. */
const fitScale = (size) => Math.max(1, 0.85 / (size.width / size.height));

/**
 * Owns the camera choreography:
 *  - intro: opens on the whole floating block, then flies in to the camp (or,
 *    back from the desktop with `startOnScreen`, pulls back out of the laptop screen)
 *  - explore: the visitor orbits, zooms toward the pointer and pans (within
 *    the island, kept out of the karst towers) with CameraControls
 *  - entering: a curved flight that ends with the laptop screen filling the view
 *  - cave: through the main waterfall into the hidden cave (utils/caveSite),
 *    where the visitor can look around; leavingCave: backing out to where it was
 *
 * During scripted flights the controls are disabled and the camera is driven
 * directly; control is handed back (synced) once a flight completes.
 */
const CameraRig = ({ phase, laptopRef, reducedMotion, startOnScreen, onIntroDone, onEntered, onDiveChange, onCaveArrived, onCaveLeft, onThroughWater }) => {
  const controlsRef = useRef();
  const flight = useRef(null);
  // Scroll/pinch-driven dive into the screen: { curve, targetFrom, targetTo, progress, goal, idle }
  const dive = useRef(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
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

    if (startOnScreen && laptopRef.current) {
      // Back from the desktop: open on the screen with its wallpaper filling
      // the view like the desktop's did, and pull back out along the path in
      camera.position.copy(hero);
      const { curve, targetTo: screenCenter } = buildScreenPath(camera, laptopRef.current, heroTarget, true);
      const points = curve.points.slice().reverse();
      camera.position.copy(points[0]);
      camera.lookAt(screenCenter);
      lookTarget.current.copy(screenCenter);
      flight.current = {
        curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
        targetFrom: screenCenter,
        targetTo: heroTarget,
        duration: CAMERA.exit.duration,
        // Hold on the screen while the wallpaper overlay fades away
        elapsed: -CAMERA.exit.hold,
        ease: easeInOutCubic,
        // Mirror of the flight in, which turns toward the screen early
        targetEase: easeInCubic,
        onDone: () => {
          handOverToControls(controls, hero, heroTarget);
          onIntroDone();
        },
      };
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
    // A click mid-dive takes over from wherever the dive has got to
    dive.current = null;
    flight.current = {
      ...buildScreenPath(camera, laptopRef.current, lookTarget.current),
      duration: reducedMotion ? 0.9 : CAMERA.enter.duration,
      elapsed: 0,
      ease: easeInOutCubic,
      targetEase: easeOutCubic,
      onDone: onEntered,
    };
  }, [phase]);

  // Into the hidden cave (and back out to where the camera was)
  const beforeCave = useRef(null);
  useEffect(() => {
    const controls = controlsRef.current;
    if (phase === 'cave' && caveSite.ready) {
      controls.enabled = false;
      dive.current = null;
      beforeCave.current = { position: camera.position.clone(), target: lookTarget.current.clone() };
      const points = [camera.position.clone(), ...caveSite.path];
      const looks = [lookTarget.current.clone(), ...caveSite.look];
      const end = points[points.length - 1];
      const endLook = looks[looks.length - 1];
      flight.current = caveFlight(points, looks, caveSite.path[2], true, reducedMotion ? 1.4 : 4.6, onThroughWater, () => {
        handOverToCave(controls, end, endLook);
        onCaveArrived?.();
      });
    } else if (phase === 'leavingCave' && beforeCave.current) {
      controls.enabled = false;
      const back = beforeCave.current;
      // Back out the way it came, still facing in, then settle on the old view
      const ahead = new THREE.Vector3();
      camera.getWorldDirection(ahead);
      const points = [camera.position.clone(), ...caveSite.path.slice(0, -1).reverse(), back.position];
      const looks = [camera.position.clone().addScaledVector(ahead, 2), caveSite.look[2], caveSite.look[0], back.target];
      flight.current = caveFlight(points, looks, caveSite.path[2], false, reducedMotion ? 1.2 : 3.8, onThroughWater, () => {
        handOverToControls(controls, back.position, back.target);
        onCaveLeft?.();
      });
    }
  }, [phase]);

  // Dive: once the camera is zoomed in close to the laptop, scrolling (or
  // pinching) further in carries it along the path into the screen.
  // Scrolling back out reverses it; the progress is the visitor's to scrub.
  useEffect(() => {
    if (phase !== 'explore') return undefined;
    const el = gl.domElement;
    const controls = controlsRef.current;

    const heroTarget = new THREE.Vector3(...CAMERA.hero.target);
    const orbitPoint = new THREE.Vector3();
    // Close in on the laptop itself (zooming toward something else just zooms)
    const closeEnough = () =>
      controls.enabled &&
      controls.distance <= DIVE_START_DISTANCE &&
      controls.getTarget(orbitPoint).distanceTo(heroTarget) < DIVE_NEAR_LAPTOP;

    // Positive amount = further in
    const push = (amount) => {
      if (!dive.current) {
        if (amount <= 0 || !closeEnough() || !laptopRef.current || flight.current) return;
        controls.enabled = false;
        dive.current = { ...buildScreenPath(camera, laptopRef.current, lookTarget.current), progress: 0, goal: 0 };
        onDiveChange?.(true);
      }
      const d = dive.current;
      d.goal = THREE.MathUtils.clamp(d.goal + amount, 0, 1);
      d.idle = 0;
    };

    const onWheel = (e) => {
      // Normalize line/page scrolling to pixels
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      push(-px * DIVE_PER_WHEEL_PX);
    };

    let pinchDistance = 0;
    const fingerDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      if (e.touches.length === 2) pinchDistance = fingerDistance(e.touches);
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinchDistance) return;
      const next = fingerDistance(e.touches);
      push((next / pinchDistance - 1) * DIVE_PER_PINCH);
      pinchDistance = next;
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchDistance = 0;
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [phase, gl, camera]);

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

    const d = dive.current;
    if (!f && d) {
      // Left half-way: settle in whichever direction it's closer to. Idle time is
      // counted in (capped) frame time, so a slow frame can't cut a scroll short.
      d.idle += Math.min(delta, 1 / 20);
      if (d.goal > 0 && d.goal < 1 && d.idle > DIVE_SETTLE_AFTER) {
        d.goal = d.goal > 0.5 ? 1 : 0;
      }
      d.progress = THREE.MathUtils.damp(d.progress, d.goal, d.goal === 1 ? 3.2 : 6, delta);
      if (d.goal === 1 && d.progress > 0.995) d.progress = 1;
      d.curve.getPointAt(d.progress, camera.position);
      lookTarget.current.lerpVectors(d.targetFrom, d.targetTo, easeOutCubic(d.progress));
      camera.lookAt(lookTarget.current);

      if (d.progress === 1) {
        dive.current = null;
        onEntered();
      } else if (d.goal === 0 && d.progress < 0.002) {
        // Backed all the way out: hand the camera back exactly where it started
        dive.current = null;
        handOverToControls(controls, d.curve.points[0], d.targetFrom);
        onDiveChange?.(false);
      }
      return;
    }

    if (!f) {
      // Nothing else pauses the controls while exploring: if no prop is held,
      // make sure they're on (a held prop can vanish before it's released)
      if (phase === 'explore' && !controls.enabled && held.size === 0) controls.enabled = true;
      // Track the orbit target so the enter flight can start from it
      if (controls.enabled) controls.getTarget(lookTarget.current);
      return;
    }

    controls.enabled = false; // nothing may re-enable controls mid-flight
    f.elapsed += Math.min(delta, 1 / 20);
    const t = THREE.MathUtils.clamp(f.elapsed / f.duration, 0, 1);
    f.curve.getPointAt(f.ease(t), camera.position);
    if (f.targetCurve) f.targetCurve.getPointAt(f.targetEase(t), lookTarget.current);
    else lookTarget.current.lerpVectors(f.targetFrom, f.targetTo, f.targetEase(t));
    camera.lookAt(lookTarget.current);
    if (f.event && !f.event.fired && f.ease(t) >= f.event.at) {
      f.event.fired = true;
      f.event.fn?.();
    }

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
  // (the cave limits the turn and turns off zoom)
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.mouseButtons.wheel = ACTION.DOLLY;
  // Zoom toward whatever is under the pointer (the waterfall, a crab...), keep out of the karsts,
  // and keep the orbit point over the island
  controls.dollyToCursor = true;
  controls.colliderMeshes = KARST_COLLIDERS;
  controls.setBoundary(ORBIT_BOUNDS);
  controls.smoothTime = 0.35;
  controls.draggingSmoothTime = 0.18;
  controls.azimuthRotateSpeed = 0.6;
  controls.polarRotateSpeed = 0.5;
  // Drag to orbit; right-drag (two fingers on touch) pans around the island
  controls.mouseButtons.right = ACTION.TRUCK;
  controls.mouseButtons.middle = ACTION.DOLLY;
  controls.dollySpeed = 0.8;
  controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
  controls.touches.three = ACTION.NONE;
  controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, false);
  controls.enabled = true;
}

/**
 * In the cave: look around without moving, by orbiting a point just in front
 * of the camera, within a limited turn (no zooming or walking through walls).
 */
function handOverToCave(controls, position, target) {
  const { ACTION } = controls.constructor;
  const ahead = target.clone().sub(position).normalize();
  const pivot = position.clone().addScaledVector(ahead, 0.05);
  // CameraControls measures the camera's offset from its target in spherical coordinates
  const azimuth = Math.atan2(-ahead.x, -ahead.z);
  const polar = Math.acos(THREE.MathUtils.clamp(-ahead.y, -1, 1));
  controls.minDistance = 0.05;
  controls.maxDistance = 0.05;
  controls.minAzimuthAngle = azimuth - 0.85;
  controls.maxAzimuthAngle = azimuth + 0.85;
  controls.minPolarAngle = polar - 0.35;
  controls.maxPolarAngle = polar + 0.3;
  controls.azimuthRotateSpeed = 0.45;
  controls.polarRotateSpeed = 0.4;
  controls.mouseButtons.wheel = ACTION.NONE;
  controls.mouseButtons.middle = ACTION.NONE;
  controls.mouseButtons.right = ACTION.NONE;
  controls.touches.two = ACTION.NONE;
  // It's inside a karst tower now: no rock to bump into, nowhere to pan
  controls.dollyToCursor = false;
  controls.colliderMeshes = [];
  controls.setBoundary();
  controls.setLookAt(position.x, position.y, position.z, pivot.x, pivot.y, pivot.z, false);
  controls.enabled = true;
}

export default CameraRig;
