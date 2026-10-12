import * as THREE from 'three';

/**
 * Shared state for the lantern lure: while the lit lantern is being carried
 * around (or was moved in the last few seconds), nearby fireflies swarm to it.
 * Written by the lantern each frame, read by the fireflies.
 */
export const lure = {
  position: new THREE.Vector3(),
  active: false,
};
