import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISLAND, KAYAK, STREAM } from './sceneConfig';
import { distanceToStream, isInKarst, isInside, sandAmount, terrainHeight } from './Island';
import { createRandom, randRange } from './utils/geometry';
import { blobMatrix, createRodGeometry, rodMatrix, setInstance } from './utils/creatures';
import { discover, world } from './utils/play';
import { weatherNow } from './utils/krabiWeather';
import { day, isDaylight } from './utils/siraDay';
import { NOT_OCCLUDER } from './utils/groundOcclusion';

/*
 * Ghost crabs on the beach: each lives in a burrow on the dry sand, comes out
 * to scuttle about sideways, and dashes back down its hole when the camera
 * comes close, Sira walks by, or someone taps it. They're out more at night
 * (as real ghost crabs are) and stay in when it rains. Drawn with a handful of
 * instanced meshes (bodies, claws, eyes, legs) for all the crabs together.
 */
const WATER = ISLAND.waterLevel;
const WALK_SPEED = 0.32;
const DASH_SPEED = 1.5;
const RANGE = 1.1; // how far from its burrow a crab wanders (m)
const SCARE_CAMERA = 2.2; // m
const SCARE_SIRA = 1.3; // m
/** Drawn a bit larger than life (a real one is ~5 cm across), so it reads from the camp. */
const SCALE = 1.35;
const SINK_DEPTH = 0.09 * SCALE;
const LEGS = 8;
const UP = new THREE.Vector3(0, 1, 0);
const RODS_PER_CRAB = LEGS * 2 + 2; // two segments per leg, two eye stalks

/** Dry sand on the beach (not in the stream, by the kayak or in a karst). */
const isBeach = (x, z) => {
  const h = terrainHeight(x, z);
  return (
    isInside(x, z, 1) &&
    sandAmount(x, z) > 0.85 &&
    h > WATER + 0.03 &&
    h < WATER + 0.35 &&
    distanceToStream(x, z) > STREAM.width * 0.6 &&
    Math.hypot(x - KAYAK.position[0], z - KAYAK.position[1]) > 1.8 &&
    !isInKarst(x, z)
  );
};

/** Burrows on the beach, nearest the camp first (so they're the ones in view), spread apart. */
const findBurrows = (count) => {
  const rand = createRandom(77);
  const candidates = [];
  for (let i = 0; i < 4000; i++) {
    const x = randRange(rand, ISLAND.min, ISLAND.max);
    const z = randRange(rand, ISLAND.min, ISLAND.max);
    if (isBeach(x, z)) candidates.push([x, z]);
  }
  candidates.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const burrows = [];
  for (const c of candidates) {
    if (burrows.every((b) => Math.hypot(b[0] - c[0], b[1] - c[1]) > 1.6)) burrows.push(c);
    if (burrows.length === count) break;
  }
  return burrows;
};

/** Leg layout in the crab's frame (x: to its sides, z: forward, y: up), in meters. */
const LEG_ROWS = [0.022, 0.007, -0.008, -0.023];

const Crab = (home, index) => ({
  index,
  home,
  pos: [...home],
  yaw: Math.random() * Math.PI * 2,
  state: 'hidden', // hidden | emerging | pause | walk | dash | hiding
  until: 1 + Math.random() * 6,
  sink: 1,
  target: null,
  gait: 0,
});

const GhostCrabs = ({ quality, interactive }) => {
  const count = quality.mobile ? 3 : 4;
  const crabs = useMemo(() => findBurrows(count).map(Crab), [count]);
  const rod = useMemo(() => createRodGeometry(5), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 10, 7), []);
  const hole = useMemo(() => new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), []);
  const refs = { body: useRef(), claws: useRef(), eyes: useRef(), rods: useRef(), holes: useRef(), hits: useRef() };
  const temp = useMemo(
    () => ({
      base: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
      q: new THREE.Quaternion(),
      yaw: new THREE.Quaternion(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      euler: new THREE.Euler(),
    }),
    []
  );

  const scare = (crab, tapped) => {
    if (crab.state === 'hidden' || crab.state === 'hiding' || crab.state === 'dash') return;
    crab.state = 'dash';
    crab.target = crab.home;
    if (tapped) discover('crab');
  };

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const { base, local, hidden, q, a, b, c, euler } = temp;
    const night = !isDaylight(day.hour);

    crabs.forEach((crab) => {
      const { index, home } = crab;
      const ground = terrainHeight(crab.pos[0], crab.pos[1]);
      const camDist = camera.position.distanceTo(a.set(crab.pos[0], ground, crab.pos[1]));
      const sira = world.sira;
      const siraNear = sira && Math.hypot(sira[0] - crab.pos[0], sira[1] - crab.pos[1]) < SCARE_SIRA;
      const out = crab.state !== 'hidden' && crab.state !== 'hiding';
      if (out && (camDist < SCARE_CAMERA || siraNear || weatherNow.rain > 0.1)) scare(crab, false);

      // --- behaviour -----------------------------------------------------------
      let moving = false;
      if (crab.state === 'hidden') {
        crab.sink = 1;
        const calm = camDist > SCARE_CAMERA * 1.5 && !siraNear && weatherNow.rain <= 0.1;
        if (t > crab.until && calm) {
          crab.state = 'emerging';
          crab.pos = [...home];
        }
      } else if (crab.state === 'emerging') {
        crab.sink = Math.max(0, crab.sink - dt * 2.5);
        if (crab.sink === 0) {
          crab.state = 'pause';
          crab.until = t + randRange(Math.random, 0.6, 1.8);
        }
      } else if (crab.state === 'pause') {
        if (t > crab.until) {
          // Off somewhere nearby on the sand, sideways
          for (let k = 0; k < 8; k++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * RANGE;
            const x = home[0] + Math.cos(ang) * r;
            const z = home[1] + Math.sin(ang) * r;
            if (isBeach(x, z)) {
              crab.target = [x, z];
              crab.state = 'walk';
              crab.until = t + randRange(Math.random, 0.5, 1.6);
              break;
            }
          }
          if (crab.state === 'pause') crab.until = t + 1;
        }
        // Now and then it heads home for a while
        if (crab.state === 'pause' && Math.random() < dt * (night ? 0.02 : 0.05)) {
          crab.state = 'dash';
          crab.target = home;
        }
      } else if (crab.state === 'walk' || crab.state === 'dash') {
        const speed = crab.state === 'dash' ? DASH_SPEED : WALK_SPEED;
        const dx = crab.target[0] - crab.pos[0];
        const dz = crab.target[1] - crab.pos[1];
        const d = Math.hypot(dx, dz);
        const step = speed * dt;
        if (d <= step || (crab.state === 'walk' && t > crab.until)) {
          if (crab.state === 'dash') {
            crab.pos = [...crab.target];
            crab.state = 'hiding';
          } else {
            crab.state = 'pause';
            crab.until = t + randRange(Math.random, 0.5, night ? 1.6 : 2.6);
          }
        } else {
          crab.pos[0] += (dx / d) * step;
          crab.pos[1] += (dz / d) * step;
          moving = true;
          // Crabs walk sideways: their side (local x) points along the way they go
          const heading = Math.atan2(-dz, dx);
          const flip = Math.cos(heading - crab.yaw) < 0 ? Math.PI : 0;
          crab.yaw += Math.atan2(Math.sin(heading + flip - crab.yaw), Math.cos(heading + flip - crab.yaw)) * Math.min(1, dt * 10);
        }
      } else if (crab.state === 'hiding') {
        crab.sink = Math.min(1, crab.sink + dt * 4);
        if (crab.sink === 1) {
          crab.state = 'hidden';
          // Out again sooner at night
          crab.until = t + (night ? randRange(Math.random, 3, 8) : randRange(Math.random, 6, 16));
        }
      }
      if (moving) crab.gait += dt * (crab.state === 'dash' ? 26 : 13);

      // --- drawing ---------------------------------------------------------------
      const visible = crab.sink < 0.999;
      const y = terrainHeight(crab.pos[0], crab.pos[1]) - crab.sink * SINK_DEPTH;
      // Standing level with the sloping sand: turned to face its way, then tipped to the slope
      const e = 0.08;
      c.set(
        terrainHeight(crab.pos[0] - e, crab.pos[1]) - terrainHeight(crab.pos[0] + e, crab.pos[1]),
        2 * e,
        terrainHeight(crab.pos[0], crab.pos[1] - e) - terrainHeight(crab.pos[0], crab.pos[1] + e)
      ).normalize();
      q.setFromUnitVectors(UP, c).multiply(temp.yaw.setFromEuler(euler.set(0, crab.yaw, 0)));
      base.compose(a.set(crab.pos[0], y, crab.pos[1]), q, b.setScalar(SCALE));
      if (!visible) {
        refs.body.current.setMatrixAt(index, hidden);
        refs.hits.current.setMatrixAt(index, hidden);
        for (let k = 0; k < 2; k++) {
          refs.claws.current.setMatrixAt(index * 2 + k, hidden);
          refs.eyes.current.setMatrixAt(index * 2 + k, hidden);
        }
        for (let k = 0; k < RODS_PER_CRAB; k++) refs.rods.current.setMatrixAt(index * RODS_PER_CRAB + k, hidden);
        return;
      }
      // Body bobs as it walks
      const bob = moving ? Math.abs(Math.sin(crab.gait)) * 0.004 : 0;
      setInstance(refs.body.current, index, base, blobMatrix(local, a.set(0, 0.03 + bob, 0), [0.052, 0.019, 0.042]));
      setInstance(refs.hits.current, index, base, blobMatrix(local, a.set(0, 0.04, 0), [0.11, 0.08, 0.11]));
      // A big claw and a small one, raised a little
      setInstance(refs.claws.current, index * 2, base, blobMatrix(local, a.set(0.032, 0.03 + bob, 0.048), [0.02, 0.012, 0.017]));
      setInstance(refs.claws.current, index * 2 + 1, base, blobMatrix(local, a.set(-0.03, 0.027 + bob, 0.045), [0.013, 0.009, 0.012]));
      // Eyes up on stalks, twitching now and then
      const twitch = Math.sin(t * 9 + index) > 0.97 ? 0.006 : 0;
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1;
        a.set(side * 0.014, 0.04 + bob, 0.03);
        b.set(side * (0.017 + twitch), 0.066 + bob, 0.033);
        setInstance(refs.rods.current, index * RODS_PER_CRAB + LEGS * 2 + s, base, rodMatrix(local, a, b, 0.0028));
        setInstance(refs.eyes.current, index * 2 + s, base, blobMatrix(local, b, [0.0055, 0.0065, 0.0055]));
      }
      // Legs: four a side, arched out and down to the sand, stepping in alternation while it walks
      for (let leg = 0; leg < LEGS; leg++) {
        const side = leg < 4 ? 1 : -1;
        const row = LEG_ROWS[leg % 4];
        const phase = crab.gait + (leg % 4) * Math.PI * 0.5 + (side > 0 ? Math.PI : 0);
        const lift = moving ? Math.max(0, Math.sin(phase)) * 0.012 : 0;
        const swing = moving ? Math.cos(phase) * 0.007 : 0;
        a.set(side * 0.04, 0.026 + bob, row);
        b.set(side * 0.063, 0.04 + bob + lift * 0.6, row * 1.15 + swing * 0.5);
        c.set(side * 0.08, lift, row * 1.45 + swing);
        setInstance(refs.rods.current, index * RODS_PER_CRAB + leg * 2, base, rodMatrix(local, a, b, 0.0046));
        setInstance(refs.rods.current, index * RODS_PER_CRAB + leg * 2 + 1, base, rodMatrix(local, b, c, 0.0036));
      }
    });
    ['body', 'claws', 'eyes', 'rods', 'hits'].forEach((key) => {
      refs[key].current.instanceMatrix.needsUpdate = true;
    });
  });

  // Burrow holes (static)
  const holeMatrices = useMemo(
    () =>
      crabs.map(({ home }) =>
        new THREE.Matrix4().compose(
          new THREE.Vector3(home[0], terrainHeight(home[0], home[1]) + 0.004, home[1]),
          new THREE.Quaternion(),
          new THREE.Vector3(0.035, 1, 0.035)
        )
      ),
    [crabs]
  );
  const setHoles = (mesh) => {
    if (!mesh) return;
    refs.holes.current = mesh;
    holeMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  };

  const onTap = (e) => {
    if (!interactive || e.delta > 6) return;
    e.stopPropagation();
    const crab = crabs[e.instanceId];
    if (crab) scare(crab, true);
  };

  if (crabs.length === 0) return null;
  const n = crabs.length;
  return (
    <group userData={NOT_OCCLUDER}>
      <instancedMesh ref={refs.body} args={[sphere, undefined, n]} castShadow frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#dccba4" roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={refs.claws} args={[sphere, undefined, n * 2]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#efe5cc" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={refs.eyes} args={[sphere, undefined, n * 2]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#1b1612" roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={refs.rods} args={[rod, undefined, n * RODS_PER_CRAB]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#d6c49b" roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={setHoles} args={[hole, undefined, n]} raycast={() => null}>
        <meshStandardMaterial color="#5a4a33" roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      {/* Invisible, finger-sized hit areas */}
      <instancedMesh ref={refs.hits} args={[sphere, undefined, n]} frustumCulled={false} onClick={onTap}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </group>
  );
};

export default React.memo(GhostCrabs);
