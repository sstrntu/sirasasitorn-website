import * as THREE from 'three';

/** Small deterministic PRNG so the jungle layout is identical on every load. */
export const createRandom = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randRange = (rand, min, max) => min + rand() * (max - min);

/**
 * Tube along a curve whose radius tapers from `radiusStart` to `radiusEnd`.
 * Used for tree trunks, branches, vines and tent poles.
 */
export const createTaperedTube = (
  curve,
  {
    radiusStart = 0.2,
    radiusEnd = 0.1,
    tubularSegments = 32,
    radialSegments = 10,
    uvScaleV = 1,
    flare = 0, // extra radius near the base (tree root flare)
  } = {}
) => {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const length = curve.getLength();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, point);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const flareAmount = flare * Math.pow(Math.max(0, 1 - t * 8), 2);
    const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t) + flareAmount;

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      normal.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
      normals.push(normal.x, normal.y, normal.z);
      positions.push(point.x + radius * normal.x, point.y + radius * normal.y, point.z + radius * normal.z);
      uvs.push(j / radialSegments, t * length * uvScaleV);
    }
  }

  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1);
      const b = (radialSegments + 1) * i + (j - 1);
      const c = (radialSegments + 1) * i + j;
      const d = (radialSegments + 1) * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

/** A tapered grass blade with a gentle bend, base at the origin. */
export const createGrassBladeGeometry = ({ height = 0.35, width = 0.025, segments = 4, bend = 0.12 } = {}) => {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = width * (1 - t) * 0.5;
    const y = t * height;
    const z = bend * t * t;
    positions.push(-w, y, z, w, y, z);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

/** Build a matrix from position, Y/X/Z euler rotation and uniform/vec scale. */
export const composeMatrix = (() => {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scaleVec = new THREE.Vector3();
  return (target, [x, y, z], [rx, ry, rz], scale) => {
    position.set(x, y, z);
    euler.set(rx, ry, rz, 'YXZ');
    quaternion.setFromEuler(euler);
    if (Array.isArray(scale)) scaleVec.set(scale[0], scale[1], scale[2]);
    else scaleVec.setScalar(scale);
    return target.compose(position, quaternion, scaleVec);
  };
})();

/*
 * --- Stylized (low-poly) shapes ---
 * Used with `flatShading` materials for the cartoon look: faceted rocks,
 * blobby tree crowns and simple palm fronds.
 */

/** Faceted low-poly rock: a displaced icosahedron, flattened so it sits naturally. */
/**
 * Rounded low-poly lump: an icosahedron whose surface bulges gently and
 * smoothly (a low-frequency wobble seeded per shape), so it reads as a soft,
 * pebble- or cloud-like form with large clean facets rather than a spiky one.
 */
const createLumpGeometry = (seed, radius, detail, amplitude, squash) => {
  const rand = createRandom(seed);
  const phase = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    // Same direction -> same offset, so shared corners stay welded
    const wobble =
      Math.sin(d.x * 2.1 + phase[0]) * 0.5 + Math.sin(d.y * 2.6 + phase[1]) * 0.3 + Math.sin(d.z * 2.3 + phase[2]) * 0.4;
    v.multiplyScalar(1 + wobble * amplitude);
    v.y *= squash;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/** Rounded boulder / stone, slightly flattened. */
export const createRockGeometry = (seed = 1, radius = 0.15, detail = 1) => createLumpGeometry(seed, radius, detail, 0.12, 0.7);

/** Soft round crown / bush / moss clump of unit radius. */
export const createBlobGeometry = (seed = 1) => createLumpGeometry(seed, 1, 2, 0.08, 1);

/** Simple palm frond: a drooping, tapered leaf strip with a serrated outline. Base at origin, along +Z. */
export const createPalmFrondGeometry = ({ length = 2.4, width = 0.55, segments = 10, droop = 0.9 } = {}) => {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = t * length;
    const y = Math.sin(t * Math.PI * 0.6) * length * 0.18 - droop * t * t * length * 0.5;
    // Serrated: alternate wide/narrow to suggest separate leaflets
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (i % 2 === 0 ? 1 : 0.55);
    positions.push(-w / 2, y - w * 0.15, z, 0, y, z, w / 2, y - w * 0.15, z);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 3;
    const b = a + 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
