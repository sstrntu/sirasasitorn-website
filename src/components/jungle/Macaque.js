import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ISLAND } from './sceneConfig';
import { isDryLand, terrainHeight } from './Island';
import { findPath } from './utils/siraPath';
import { blobMatrix, createRodGeometry, rodMatrix, solveJoint } from './utils/creatures';
import { discover, emit, loot, world } from './utils/play';
import { weatherNow } from './utils/krabiWeather';
import { day, isSleepTime } from './utils/siraDay';
import { NOT_OCCLUDER } from './utils/groundOcclusion';

/*
 * A long-tailed macaque, the coconut thief of Krabi's beaches. Every few
 * minutes by day (not in the rain) it creeps out of the jungle on all fours,
 * takes a coconut lying about camp (or the mug, if it's on the ground) in its
 * mouth, scampers off a little way and sits to gnaw at it, then drops it and
 * wanders off. Tap it, or snatch its prize back, and it drops everything and
 * flees; it bolts from Sira too.
 *
 * Built and animated in code: ellipsoid body parts, and limbs and tail as rods
 * in one instanced mesh, posed every frame. Walking uses the primates'
 * diagonal-sequence gait with two-bone IK legs; it also gallops, sits and grabs.
 */
const WALK_SPEED = 0.8;
const RUN_SPEED = 2.6;
const WALK_STRIDE = 0.34;
const RUN_STRIDE = 0.78;
const STAND_HEIGHT = 0.235; // torso center above the ground while walking
const CAMP_RADIUS = 7; // only things this close to camp get stolen
const FIRST_VISIT = [35, 60]; // seconds after the scene starts
const VISIT_GAP = [150, 240];
const SIRA_TOO_CLOSE = 1.6;
const TAIL_SEGMENTS = 9;
const TAIL_SEGMENT = 0.06;

/** Limbs in the torso's frame (x to its left, y up, z forward): joint, foot rest spot, segment lengths, gait offsets. */
const LIMBS = [
  { name: 'foreL', joint: [0.055, -0.035, 0.115], rest: [0.065, 0, 0.13], a: 0.12, b: 0.12, walk: 0.75, run: 0.5, bend: [0.2, 0, -1], fore: true },
  { name: 'foreR', joint: [-0.055, -0.035, 0.115], rest: [-0.065, 0, 0.13], a: 0.12, b: 0.12, walk: 0.25, run: 0.58, bend: [-0.2, 0, -1], fore: true },
  { name: 'hindL', joint: [0.055, -0.03, -0.12], rest: [0.07, 0, -0.1], a: 0.135, b: 0.13, walk: 0, run: 0, bend: [0.15, 0, 1], fore: false },
  { name: 'hindR', joint: [-0.055, -0.03, -0.12], rest: [-0.07, 0, -0.1], a: 0.135, b: 0.13, walk: 0.5, run: 0.08, bend: [-0.15, 0, 1], fore: false },
];
const RODS = LIMBS.length * 2 + TAIL_SEGMENTS;

const FUR = '#8a7a62';
const FUR_LIGHT = '#a6977f';
const BELLY = '#b8aa90';
const SKIN = '#b8948a';

const rand = (a, b) => a + Math.random() * (b - a);

/** Places at the jungle's edge it can come from and go back to. */
const EDGE_POINTS = (() => {
  const points = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    for (const r of [8.5, 9.5, 10.5]) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (isDryLand(x, z, 1.5)) {
        points.push([x, z]);
        break;
      }
    }
  }
  return points;
})();

/** Coconuts (or the mug) lying still on dry ground near camp, not in anyone's hand. */
const findPrize = () => {
  let best = null;
  loot.forEach((entry) => {
    const rb = entry.body.current;
    if (!rb || entry.held()) return;
    const p = rb.translation();
    const v = rb.linvel();
    const ground = terrainHeight(p.x, p.z);
    const still = Math.hypot(v.x, v.y, v.z) < 0.2;
    if (!still || p.y > ground + 0.3 || ground < ISLAND.waterLevel + 0.05 || Math.hypot(p.x, p.z) > CAMP_RADIUS) return;
    const score = Math.random() + (entry.kind === 'coconut' ? 0.5 : 0);
    if (!best || score > best.score) best = { entry, score };
  });
  return best?.entry || null;
};

const Macaque = ({ interactive }) => {
  const root = useRef();
  const body = useRef();
  const head = useRef();
  const rods = useRef();
  const paws = useRef();
  const geometries = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 16, 12),
      rod: createRodGeometry(7),
      // Torso: one smooth capsule along its length
      torso: new THREE.CapsuleGeometry(1, 2.6, 8, 16).rotateX(Math.PI / 2),
    }),
    []
  );
  const materials = useMemo(
    () => ({
      fur: new THREE.MeshStandardMaterial({ color: FUR, roughness: 0.95 }),
      light: new THREE.MeshStandardMaterial({ color: FUR_LIGHT, roughness: 0.95 }),
      belly: new THREE.MeshStandardMaterial({ color: BELLY, roughness: 0.95 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.75 }),
      eye: new THREE.MeshStandardMaterial({ color: '#16110c', roughness: 0.25 }),
    }),
    []
  );
  const state = useRef({
    mode: 'away', // away | enter | grab | escape | eat | leave | flee
    next: null,
    pos: [0, 0],
    yaw: 0,
    speed: 0,
    phase: 0,
    route: [],
    exit: null,
    prize: null,
    carrying: false,
    modeT: 0,
    sit: 0,
    grab: 0,
    shown: 0,
    look: { yaw: 0, pitch: 0 },
  });
  const temp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      bodyMatrix: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      joint: new THREE.Vector3(),
      foot: new THREE.Vector3(),
      knee: new THREE.Vector3(),
      bend: new THREE.Vector3(),
      prize: new THREE.Vector3(),
      hold: new THREE.Vector3(),
    }),
    []
  );

  /** Lets go of its prize (with a little toss). */
  const drop = (toss = 0.6) => {
    const s = state.current;
    const rb = s.prize?.body.current;
    if (s.carrying && rb) {
      rb.setLinvel({ x: Math.sin(s.yaw) * toss, y: toss * 1.4, z: Math.cos(s.yaw) * toss }, true);
    }
    s.carrying = false;
    s.prize = null;
  };

  const goTo = (target) => {
    const s = state.current;
    s.route = findPath(s.pos, target);
  };

  const flee = (chased) => {
    const s = state.current;
    if (s.mode === 'away' || s.mode === 'flee') return;
    drop(1.2);
    s.mode = 'flee';
    s.modeT = 0;
    // The nearest way out
    s.exit = EDGE_POINTS.reduce((best, p) => (!best || Math.hypot(p[0] - s.pos[0], p[1] - s.pos[1]) < Math.hypot(best[0] - s.pos[0], best[1] - s.pos[1]) ? p : best), null);
    goTo(s.exit);
    if (chased) {
      discover('monkey');
      emit('monkey', { type: 'fled' });
    }
  };

  const onTap = (e) => {
    if (!interactive || e.delta > 6) return;
    e.stopPropagation();
    flee(true);
  };

  useFrame(({ camera, clock }, delta) => {
    const s = state.current;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const group = root.current;
    if (!group) return;
    const { m, local, bodyMatrix, q, e, v, w, joint, foot, knee, bend, prize, hold } = temp;

    // --- what it's up to ---------------------------------------------------------------
    if (s.mode === 'away') {
      group.visible = false;
      if (s.next === null) s.next = t + rand(...FIRST_VISIT);
      if (t < s.next) return;
      const calm = !isSleepTime(day.hour) && day.hour >= 7 && day.hour < 18 && weatherNow.rain < 0.2;
      const target = calm && findPrize();
      if (!target) {
        s.next = t + 20;
        return;
      }
      const p = target.body.current.translation();
      // Come from the jungle behind the prize (as the camera sees it), well away from Sira
      const cam = [camera.position.x, camera.position.z];
      const sira = world.sira || [0, 0];
      const scored = EDGE_POINTS.map((pt) => {
        const toPrize = Math.hypot(pt[0] - p.x, pt[1] - p.z);
        const nearCamera = Math.hypot(pt[0] - cam[0], pt[1] - cam[1]) < Math.hypot(p.x - cam[0], p.z - cam[1]) ? 8 : 0;
        const nearSira = Math.hypot(pt[0] - sira[0], pt[1] - sira[1]) < 3 ? 10 : 0;
        return [toPrize + nearCamera + nearSira, pt];
      }).sort((a, b) => a[0] - b[0]);
      const entry = scored[0]?.[1];
      if (!entry) {
        s.next = t + 30;
        return;
      }
      s.exit = entry;
      s.pos = [...entry];
      s.yaw = Math.atan2(p.x - entry[0], p.z - entry[1]);
      s.prize = target;
      s.carrying = false;
      s.mode = 'enter';
      s.modeT = 0;
      s.shown = 0;
      s.sit = 0;
      s.grab = 0;
      goTo([p.x, p.z]);
      group.visible = true;
    }
    s.modeT += dt;

    // Its prize vanished (cracked open, cleared away) or was snatched back
    if (s.prize && (!loot.has(s.prize) || !s.prize.body.current)) {
      s.prize = null;
      s.carrying = false;
      if (s.mode === 'enter' || s.mode === 'grab') flee(false);
    } else if (s.prize?.held()) {
      flee(true);
    }
    // Sira coming close sends it running
    const sira = world.sira;
    if (sira && s.mode !== 'flee' && Math.hypot(sira[0] - s.pos[0], sira[1] - s.pos[1]) < SIRA_TOO_CLOSE) flee(false);
    if (weatherNow.rain >= 0.4 && s.mode !== 'flee') flee(false);

    let speedTarget = 0;
    if (s.mode === 'enter' || s.mode === 'leave' || s.mode === 'escape' || s.mode === 'flee') {
      // Keep the route aimed at a prize that rolled
      if (s.mode === 'enter' && s.prize) {
        const p = s.prize.body.current.translation();
        const end = s.route[s.route.length - 1];
        if (!end || Math.hypot(end[0] - p.x, end[1] - p.z) > 0.15) goTo([p.x, p.z]);
      }
      const running = s.mode === 'escape' || s.mode === 'flee';
      // Creeping in: a few cautious stops to look around
      const pausing = s.mode === 'enter' && Math.sin(s.modeT * 0.9) > 0.85;
      speedTarget = pausing ? 0 : running ? RUN_SPEED : WALK_SPEED;
      const next = s.route[0];
      if (next) {
        const dx = next[0] - s.pos[0];
        const dz = next[1] - s.pos[1];
        const d = Math.hypot(dx, dz);
        const reach = s.route.length === 1 && s.mode === 'enter' ? 0.2 : 0.08;
        if (d < reach) s.route.shift();
        else {
          const heading = Math.atan2(dx, dz);
          s.yaw += Math.atan2(Math.sin(heading - s.yaw), Math.cos(heading - s.yaw)) * Math.min(1, dt * 7);
        }
      }
      if (!s.route.length) {
        if (s.mode === 'enter') {
          s.mode = 'grab';
          s.modeT = 0;
        } else if (s.mode === 'escape') {
          s.mode = 'eat';
          s.modeT = 0;
          s.eatFor = rand(14, 22);
        } else {
          // Out of sight at the jungle's edge
          s.shown = Math.max(0, s.shown - dt * 2.5);
          if (s.shown === 0) {
            drop(0);
            s.mode = 'away';
            s.next = t + rand(...VISIT_GAP);
            group.visible = false;
            return;
          }
        }
      }
    } else if (s.mode === 'grab') {
      if (s.prize) {
        const p = s.prize.body.current.translation();
        s.yaw += Math.atan2(Math.sin(Math.atan2(p.x - s.pos[0], p.z - s.pos[1]) - s.yaw), Math.cos(Math.atan2(p.x - s.pos[0], p.z - s.pos[1]) - s.yaw)) * Math.min(1, dt * 6);
      }
      if (s.modeT > 0.45 && !s.carrying && s.prize) {
        s.carrying = true;
        emit('monkey', { type: 'stole', kind: s.prize.kind, position: [...s.pos] });
      }
      if (s.modeT > 0.8) {
        // Off with it: a few meters toward where it came from, still in view
        const away = [s.exit[0] - s.pos[0], s.exit[1] - s.pos[1]];
        const len = Math.hypot(...away) || 1;
        let spot = [s.pos[0] + (away[0] / len) * 3, s.pos[1] + (away[1] / len) * 3];
        if (!isDryLand(spot[0], spot[1], 1)) spot = [s.pos[0] + (away[0] / len) * 1.5, s.pos[1] + (away[1] / len) * 1.5];
        s.mode = 'escape';
        s.modeT = 0;
        goTo(spot);
      }
    } else if (s.mode === 'eat') {
      if (s.modeT > s.eatFor) {
        drop(0.3);
        s.mode = 'leave';
        s.modeT = 0;
        goTo(s.exit);
      }
    }

    // Move along
    s.speed = THREE.MathUtils.damp(s.speed, speedTarget, 6, dt);
    const step = s.speed * dt;
    if (step > 0) {
      s.pos[0] += Math.sin(s.yaw) * step;
      s.pos[1] += Math.cos(s.yaw) * step;
    }
    const running = s.speed > WALK_SPEED * 1.4;
    const stride = running ? RUN_STRIDE : WALK_STRIDE;
    s.phase = (s.phase + step / stride) % 1;
    const move = THREE.MathUtils.clamp(s.speed / WALK_SPEED, 0, 1);
    const gallop = THREE.MathUtils.smoothstep(s.speed, WALK_SPEED, RUN_SPEED * 0.8);
    s.sit = THREE.MathUtils.damp(s.sit, s.mode === 'eat' ? 1 : 0, 5, dt);
    s.grab = THREE.MathUtils.damp(s.grab, s.mode === 'grab' ? 1 : 0, 8, dt);
    if (s.mode !== 'leave' && s.mode !== 'flee') s.shown = Math.min(1, s.shown + dt * 2.5);

    // --- pose ----------------------------------------------------------------------------
    const ground = terrainHeight(s.pos[0], s.pos[1]);
    group.position.set(s.pos[0], ground, s.pos[1]);
    group.rotation.set(0, s.yaw, 0);
    group.scale.setScalar(Math.max(0.001, s.shown));

    // Torso: bobbing walk, pitching gallop, leaning down to grab, upright to sit
    const bob = move * (Math.sin(s.phase * Math.PI * 4) * 0.007 * (1 - gallop) + Math.sin(s.phase * Math.PI * 2) * 0.022 * gallop);
    const pitch = gallop * Math.sin(s.phase * Math.PI * 2 + 0.6) * 0.13 + s.grab * 0.38 - s.sit * 1.15;
    const height = THREE.MathUtils.lerp(STAND_HEIGHT + bob - s.grab * 0.04, 0.152, s.sit);
    const forward = s.sit * -0.02;
    body.current.position.set(0, height, forward);
    body.current.rotation.set(pitch, 0, 0);
    body.current.updateMatrix();
    bodyMatrix.copy(body.current.matrix);

    // Head: looks about, at the camera now and then, at its prize, and level while it sits
    const lookAtCamera = Math.sin(t * 0.37) > 0.4 && s.mode !== 'flee';
    let lookYaw = Math.sin(t * 0.8) * 0.35 * (1 - move);
    if (lookAtCamera) {
      const angle = Math.atan2(camera.position.x - s.pos[0], camera.position.z - s.pos[1]) - s.yaw;
      lookYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -1.1, 1.1);
    }
    s.look.yaw = THREE.MathUtils.damp(s.look.yaw, lookYaw, 4, dt);
    s.look.pitch = THREE.MathUtils.damp(s.look.pitch, s.sit * 1.05 - s.grab * 0.35 + (s.mode === 'eat' ? Math.sin(t * 3) * 0.08 : 0), 6, dt);
    head.current.rotation.set(s.look.pitch, s.look.yaw, 0, 'YXZ');

    // Where the prize is held: in its mouth on the move, in both hands while it sits and gnaws
    head.current.updateWorldMatrix(true, false);
    if (s.sit > 0.5) hold.set(0, 0.315 + Math.sin(t * 2.6) * 0.012, 0.15).applyMatrix4(group.matrixWorld);
    else hold.set(0, -0.035, 0.11).applyMatrix4(head.current.matrixWorld);
    if (s.prize) {
      const p = s.prize.body.current.translation();
      prize.set(p.x, p.y, p.z);
    }

    // Limbs: gait feet (walk or gallop), the right hand reaching for the prize, a seated pose
    const rodMesh = rods.current;
    const pawMesh = paws.current;
    group.updateMatrixWorld();
    const toLocal = m.copy(group.matrixWorld).invert();
    LIMBS.forEach((limb, i) => {
      joint.fromArray(limb.joint).applyMatrix4(bodyMatrix);
      // Gait: stance (foot planted, sliding back) then swing (lifted, forward)
      const offset = THREE.MathUtils.lerp(limb.walk, limb.run, gallop);
      const duty = THREE.MathUtils.lerp(0.62, 0.4, gallop);
      const p = (s.phase + offset) % 1;
      let along;
      let lift;
      if (p < duty) {
        along = stride * (0.5 - p / duty);
        lift = 0;
      } else {
        const k = (p - duty) / (1 - duty);
        along = stride * (-0.5 + k);
        lift = Math.sin(k * Math.PI) * (running ? 0.08 : 0.045);
      }
      foot.set(limb.rest[0], lift * move, limb.rest[2] + along * move);
      bend.fromArray(limb.bend);
      if (s.sit > 0.01) {
        // Seated: hind feet out in front with the knees up, hands holding the prize at its mouth
        const seat = limb.fore ? v.set(limb.rest[0] * 0.35, 0.3 + Math.sin(t * 2.6) * 0.012, 0.13) : v.set(limb.rest[0] * 1.15, 0, 0.11);
        foot.lerp(seat, s.sit);
        bend.lerp(limb.fore ? w.set(limb.rest[0] * 3, -1, -0.6) : w.set(limb.rest[0] * 2, 1, 0.4), s.sit);
      }
      if (limb.name === 'foreR' && s.grab > 0.01 && s.prize) {
        foot.lerp(v.copy(prize).applyMatrix4(toLocal), s.grab);
      }
      solveJoint(knee, joint, foot, limb.a, limb.b, bend);
      rodMesh.setMatrixAt(i * 2, rodMatrix(local, joint, knee, limb.fore ? 0.02 : 0.023));
      rodMesh.setMatrixAt(i * 2 + 1, rodMatrix(local, knee, foot, limb.fore ? 0.016 : 0.018));
      // Hands and feet (feet are longer)
      q.setFromEuler(e.set(0, 0, 0));
      pawMesh.setMatrixAt(i, blobMatrix(local, w.copy(foot).setY(foot.y + 0.008), limb.fore ? [0.017, 0.01, 0.022] : [0.018, 0.011, 0.034], q));
    });

    // Tail: up from the rump, arcing down and back, swaying; lying on the ground when it sits
    let tailPitch = THREE.MathUtils.lerp(0.55, 0.15, gallop);
    let tailYaw = 0;
    joint.set(0, 0.02, -0.17).applyMatrix4(bodyMatrix);
    for (let k = 0; k < TAIL_SEGMENTS; k++) {
      tailPitch -= 0.21 + gallop * -0.12;
      tailYaw = Math.sin(t * 1.7 - k * 0.55) * 0.12 * (1 - s.sit * 0.5);
      foot.set(Math.sin(tailYaw) * Math.cos(tailPitch), Math.sin(tailPitch), -Math.cos(tailYaw) * Math.cos(tailPitch));
      knee.copy(joint).addScaledVector(foot, TAIL_SEGMENT);
      knee.y = Math.max(knee.y, 0.012);
      rodMesh.setMatrixAt(LIMBS.length * 2 + k, rodMatrix(local, joint, knee, THREE.MathUtils.lerp(0.016, 0.007, k / TAIL_SEGMENTS)));
      joint.copy(knee);
    }
    rodMesh.instanceMatrix.needsUpdate = true;
    pawMesh.instanceMatrix.needsUpdate = true;

    // --- the prize, carried --------------------------------------------------------------
    const rb = s.prize?.body.current;
    if (s.carrying && rb) {
      const p = rb.translation();
      const gain = Math.min(0.65 / Math.max(delta, 1 / 240), 60);
      v.set(hold.x - p.x, hold.y - p.y, hold.z - p.z).multiplyScalar(gain);
      if (v.length() > 25) v.setLength(25);
      rb.setLinvel(v, true);
      const spin = rb.angvel();
      rb.setAngvel({ x: spin.x * 0.8, y: spin.y * 0.8, z: spin.z * 0.8 }, true);
    }
  });

  const { sphere, rod, torso } = geometries;
  const { fur, light, belly, skin, eye } = materials;
  return (
    // Drawn (tiny) until the first frame so its shaders compile with the rest of the scene
    <group ref={root} scale={0.0001} userData={NOT_OCCLUDER}>
      {/* Limbs and tail (rods), hands and feet: posed every frame in the root's frame */}
      <instancedMesh ref={rods} args={[rod, fur, RODS]} castShadow frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={paws} args={[sphere, skin, LIMBS.length]} castShadow frustumCulled={false} raycast={() => null} />
      <group ref={body}>
        {/* Torso: a smooth capsule with a slightly rounder rump and a paler belly */}
        <mesh geometry={torso} material={fur} scale={[0.07, 0.074, 0.07]} castShadow />
        <mesh geometry={sphere} material={fur} scale={[0.076, 0.078, 0.085]} position={[0, 0.006, -0.105]} castShadow />
        <mesh geometry={sphere} material={belly} scale={[0.052, 0.05, 0.14]} position={[0, -0.03, 0.01]} />
        <group ref={head} position={[0, 0.06, 0.215]}>
          {/* Head with the grey cheek whiskers and crown of a long-tailed macaque */}
          <mesh geometry={sphere} material={fur} scale={[0.058, 0.056, 0.058]} position={[0, 0.012, 0]} castShadow />
          <mesh geometry={sphere} material={light} scale={[0.07, 0.05, 0.04]} position={[0, -0.002, 0.012]} />
          <mesh geometry={sphere} material={fur} scale={[0.035, 0.016, 0.03]} position={[0, 0.06, -0.01]} />
          {/* Face: flat and pinkish, a short muzzle, a brow ridge, dark eyes */}
          <mesh geometry={sphere} material={skin} scale={[0.036, 0.04, 0.022]} position={[0, 0.0, 0.042]} />
          <mesh geometry={sphere} material={skin} scale={[0.024, 0.02, 0.022]} position={[0, -0.018, 0.058]} />
          <mesh geometry={sphere} material={fur} scale={[0.036, 0.009, 0.014]} position={[0, 0.022, 0.054]} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh geometry={sphere} material={eye} scale={0.0075} position={[side * 0.016, 0.01, 0.061]} />
              <mesh geometry={sphere} material={skin} scale={[0.008, 0.015, 0.012]} position={[side * 0.056, 0.012, -0.004]} />
            </group>
          ))}
        </group>
      </group>
      {/* Tap target */}
      <mesh geometry={sphere} scale={0.26} position={[0, 0.22, 0]} onClick={onTap}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
};

export default React.memo(Macaque);
