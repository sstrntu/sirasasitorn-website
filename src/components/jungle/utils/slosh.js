import * as THREE from 'three';
import { tipWaves } from './waves';

/**
 * Tipping the island: when the visitor spins or tilts the view, the water
 * should lag behind like water in a tray that's been tipped.
 *
 * The camera's angular velocity around its target is turned into a "tilt"
 * direction in world XZ. Whenever that changes (starting, speeding up or
 * stopping a spin), the change kicks the wave simulation, and the block's
 * walls turn the kick into sloshing waves.
 */

// How strongly camera rotation (rad/s) tips the water
const DRIVE = 1.6;
const MAX_TILT = 1.2;

const previous = { azimuth: null, elevation: 0 };
const offset = new THREE.Vector3();
const tilt = new THREE.Vector2();
const target = new THREE.Vector2();

/** Feed the camera's motion around `lookTarget` into the waves. Call once per frame. */
export const updateSlosh = (camera, lookTarget, delta) => {
  const dt = Math.min(delta, 1 / 20);
  if (dt <= 0) return;
  offset.subVectors(camera.position, lookTarget);
  const azimuth = Math.atan2(offset.z, offset.x);
  const elevation = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
  if (previous.azimuth === null) {
    previous.azimuth = azimuth;
    previous.elevation = elevation;
  }
  let dAzimuth = azimuth - previous.azimuth;
  dAzimuth = Math.atan2(Math.sin(dAzimuth), Math.cos(dAzimuth));
  const dElevation = elevation - previous.elevation;
  previous.azimuth = azimuth;
  previous.elevation = elevation;

  // Spinning pushes the water sideways on screen; tilting pushes it toward/away from the viewer
  const spin = (dAzimuth / dt) * DRIVE;
  const tip = (dElevation / dt) * DRIVE * 1.5;
  target.set(-Math.sin(azimuth) * spin + Math.cos(azimuth) * tip, Math.cos(azimuth) * spin + Math.sin(azimuth) * tip);
  if (target.length() > MAX_TILT) target.setLength(MAX_TILT);

  // Smooth the drive a little so a jittery drag doesn't buzz the surface
  const before = tilt.clone();
  tilt.lerp(target, 1 - Math.exp(-12 * dt));
  const change = tilt.clone().sub(before);
  if (change.lengthSq() > 1e-8) tipWaves(change.x, change.y);
};
