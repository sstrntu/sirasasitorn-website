import * as THREE from 'three';

/*
 * Small helpers for the island's animals (GhostCrabs, Hornbills, Macaque):
 * placing stretched unit shapes in instanced meshes, and a two-bone IK solve
 * for legs.
 */

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

/**
 * Matrix that turns a unit cylinder (radius 1, y from 0 to 1) into a rod from
 * `from` to `to` of the given radius (all in the same space).
 */
export const rodMatrix = (out, from, to, radius) => {
  tmpDir.subVectors(to, from);
  const length = tmpDir.length() || 1e-6;
  tmpQuat.setFromUnitVectors(UP, tmpDir.divideScalar(length));
  tmpScale.set(radius, length, radius);
  return out.compose(from, tmpQuat, tmpScale);
};

/** Matrix for a unit sphere stretched to `scale` ([x, y, z] radii), turned by `quaternion`, at `position`. */
export const blobMatrix = (out, position, scale, quaternion = tmpQuat.identity()) => {
  tmpScale.set(scale[0], scale[1], scale[2]);
  return out.compose(position, quaternion, tmpScale);
};

/** `local` placed in `parent`'s frame (parent * local), written to instance `index`. */
export const setInstance = (mesh, index, parent, local) => {
  mesh.setMatrixAt(index, tmpMatrix.multiplyMatrices(parent, local));
};

/** Unit cylinder from y = 0 to 1, for rods (legs, stalks, tails). */
export const createRodGeometry = (radial = 6) => {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, radial, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
};

/**
 * Two-bone IK: where the middle joint (knee, elbow) goes for a limb from
 * `root` to `target` with segment lengths `a` and `b`, bending toward `bend`
 * (a direction). Writes the joint into `out`; the target is pulled in if out of reach.
 */
export const solveJoint = (out, root, target, a, b, bend) => {
  tmpDir.subVectors(target, root);
  const d = THREE.MathUtils.clamp(tmpDir.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  tmpDir.normalize();
  // Distance along root->target to the joint's foot, and how far the joint sits off that line
  const along = (a * a - b * b + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, a * a - along * along));
  // Bend direction, made perpendicular to the limb
  const side = bend.clone().addScaledVector(tmpDir, -bend.dot(tmpDir));
  if (side.lengthSq() < 1e-8) side.set(0, 1, 0);
  side.normalize();
  return out.copy(root).addScaledVector(tmpDir, along).addScaledVector(side, off);
};

/** Shortest signed difference between two angles (radians). */
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
