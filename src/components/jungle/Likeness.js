import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils';
import { ASSETS, ISLAND, LAPTOP_FOCUS, LAYOUT, prefersReducedMotion } from './sceneConfig';
import { terrainHeight } from './Island';
import { BUCKET, BucketModel } from './Bucket';
import { disturbWaves, isOverWater, waveHeightAt } from './utils/waves';
import { bucket, emitBurst, fire, held, kayak, on } from './utils/play';
import { findPath } from './utils/siraPath';
import { POSES, addAngles, cheerMotion, combine, createPoser, paddleStroke, palmPosition, swimStroke, waveMotion, walkBob, walkCycle } from './utils/siraPose';
import { ACTIVITIES, BED_POSE, chooseActivity, sleepingSteps } from './utils/siraActivities';
import { day, isSleepTime } from './utils/siraDay';

/*
 * Sira as a Pixar-style cartoon living on the island. Higgsfield made the
 * character (Nano Banana Pro portrait from photos -> Tripo image-to-3D); the
 * skeleton and skin weights were added in Blender. The model is normalized to
 * height 1 with the feet at y = 0, facing +X.
 *
 * It runs like a little simulation on the visitor's clock (siraActivities,
 * siraDay): he picks activities and walks, wades, swims or paddles between
 * them: building the fire from the woodpile and tending it, sitting on the
 * log, working at the laptop, napping in the chair after lunch, shaking
 * coconuts off palms, swimming, kayaking; at bedtime he puts the fire out with
 * a bucket of sea water and sleeps in the tent until morning. All motion is
 * procedural bone posing (siraPose). Visitors can interrupt him: tapping makes
 * him wave (every third tap he points at the laptop, which opens /pro), thrown
 * props make him flinch, and he cheers at their discoveries. A dead fire sends
 * him to build a new one.
 */
const HEIGHT = 1.64; // m
const WALK_SPEED = 1.1; // m/s on land
const WADE_SPEED = 0.6;
const SWIM_SPEED = 0.5;
const PADDLE_SPEED = 1.4;
/** One walk cycle (two steps) covers this distance (m): matches the leg swing, so the feet don't skate. */
const STRIDE = 0.95;
/** Deeper water than this (m) and he swims, floating with his shoulders above it. */
const SWIM_DEPTH = 1.0;
/** Props hitting him faster than this (m/s) make him flinch. */
const FLINCH_SPEED = 1.4;
/** Look at the camera instead of the cursor once it has been still this long (s). */
const POINTER_IDLE = 4;
/** Seconds between unprompted laptop hints while he's around camp. */
const HINT_INTERVAL = [40, 60];
/** Taps that wake him in the night, if they come within this many seconds of each other. */
const WAKE_TAPS = 3;
const WAKE_TAP_GAP = 8;
const REACTION_SECONDS = { wave: 2.2, point: 3.8, flinch: 0.9, cheer: 1.6 };
/** Poses he sits, kneels or lies in: reactions keep their legs. */
const LOWERED = new Set(['crouch', 'type', 'sit', 'kayak', 'swim', 'strike', 'blow', 'pickup', 'scoop', 'kneel', 'nap', 'sleep']);
/** The bucket: how long filling and emptying it take (s), how far it tips to pour, and its handle's height. */
const FILL_SECONDS = 1.1;
const POUR_SECONDS = 1.5;
const POUR_TILT = 1.9;
const HANDLE = BUCKET.height + BUCKET.top * 0.98;

const LINES = {
  hello: ["Hi, I'm Sira! 👋", 'Welcome to my island!', 'Hey there!', 'Try tossing a coconut!', 'Tap the campfire 🔥'],
  hint: ['My work is on that laptop →', 'Psst… open the laptop!', 'Projects are in there →'],
  hintAway: ['My work is on the laptop at camp!'],
  ouch: ['Hey! 😅', 'Ouch!', 'Watch it!'],
  cheer: ['Yes! 🎉', 'Nice one!', 'Woohoo!'],
  sleepy: ['Zzz… 😴', 'Zzz… zzz…'],
  stirring: ['Mmm… five more minutes…', 'Mmm… what is it? 😴'],
  awake: ['Okay, okay, I’m up! 😅', 'Huh? Oh, hi! 😴'],
  woken: ['Oh! Hi there 👋', 'Huh? I wasn’t asleep! 😅'],
  startled: ['Huh?! 😳', 'Whoa! I’m up, I’m up!'],
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const WATER = [0.75, 0.9, 1.0];
const UP = new THREE.Vector3(0, 1, 0);
const PADDLE_AXIS = new THREE.Vector3(0, 0, 1);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dampAngle = (from, to, rate, dt) => from + wrap(to - from) * (1 - Math.exp(-rate * dt));
/** Root yaw that makes the model (facing +X) face along (dx, dz). */
const yawToward = (dx, dz) => Math.atan2(-dz, dx);
/** Kayak heading (bow along (sin h, cos h)) as a root yaw. */
const kayakYaw = (heading) => yawToward(Math.sin(heading), Math.cos(heading));

const SpeechBubble = ({ text, onSelect }) => (
  <Html center zIndexRange={[11, 0]} style={{ pointerEvents: onSelect && text ? 'auto' : 'none' }}>
    <div className={`jungle-sira-bubble ${text ? 'is-visible' : ''}`}>
      {text}
      {onSelect && text && (
        <button type="button" className="jungle-sira-bubble-action" onClick={onSelect}>
          Open it
        </button>
      )}
    </div>
  </Html>
);

/** Z's drifting up while he sleeps. */
const Snooze = ({ visible }) => (
  <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
    <div className={`jungle-sira-zzz ${visible ? 'is-visible' : ''}`} aria-hidden="true">
      <span>z</span>
      <span>z</span>
      <span>Z</span>
    </div>
  </Html>
);

/** A kayak paddle held across the body (shaft along local Z). */
const Paddle = React.forwardRef((props, ref) => (
  <group ref={ref} visible={false}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.014, 0.014, 2.1, 8]} />
      <meshStandardMaterial color="#2b2d31" roughness={0.6} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[0, 0, s * 1.0]} rotation={[0, 0, s * 0.4]} castShadow>
        <boxGeometry args={[0.012, 0.16, 0.4]} />
        <meshStandardMaterial color="#ffb000" roughness={0.6} />
      </mesh>
    ))}
  </group>
));

/** An armful of firewood: three logs lying along local Z, carried across his forearms. */
const ARMFUL = [
  [-0.035, 0, 0],
  [0.035, 0, 0.02],
  [0, 0.06, -0.01],
];
const Armful = React.forwardRef((props, ref) => (
  <group ref={ref} visible={false}>
    {ARMFUL.map((p, i) => (
      <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.038, 0.4, 7]} />
        <meshStandardMaterial color="#6e5038" roughness={0.9} flatShading />
      </mesh>
    ))}
  </group>
));

const Likeness = ({ interactive, onSelectLaptop, hour }) => {
  const { scene } = useGLTF(ASSETS.likeness, ASSETS.draco);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  if (hour !== undefined) day.hour = hour;

  // Skinned meshes need SkeletonUtils to clone
  const rig = useMemo(() => {
    const model = cloneSkinned(scene);
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Matte cartoon skin and cloth: no glints flickering as the camera moves
        o.material.roughness = Math.max(o.material.roughness ?? 0.85, 0.75);
        o.material.metalness = 0;
        // Bounds are computed in the rest pose; posed limbs shouldn't get culled
        o.frustumCulled = false;
      }
    });
    model.scale.setScalar(HEIGHT);
    return { model, bones, poser: createPoser(model, bones, HEIGHT) };
  }, [scene]);

  const root = useRef();
  const body = useRef();
  const paddle = useRef();
  const armful = useRef();
  const carriedBucket = useRef();
  const bucketWater = useRef();
  const overHead = useRef();
  const hitArea = useRef();
  const collider = useRef();
  const clockRef = useRef(null);
  const [bubble, setBubble] = useState(null); // { text, laptop }
  const [snoozing, setSnoozing] = useState(false);
  const state = useRef(null);
  if (!state.current) {
    const [x, , z] = LAYOUT.likeness.position;
    // Arriving at night, the visitor finds him already in bed (and the fire out: utils/play)
    const asleep = isSleepTime(day.hour);
    state.current = {
      pos: asleep ? [BED_POSE.anchor[0], BED_POSE.anchor[2]] : [x, z],
      y: 0,
      yaw: asleep ? yawToward(...BED_POSE.facing) : 0,
      activity: asleep ? 'bedtime' : null,
      steps: asleep ? sleepingSteps() : [],
      step: null,
      stepT: 0,
      route: [],
      idleUntil: 1.5,
      // Settle straight into the first pose instead of easing in from standing
      snap: true,
      phase: 0,
      walkAmt: 0,
      riding: false,
      swimming: false,
      reaction: null, // { type, start }
      pending: null,
      hop: -1,
      taps: 0,
      nextHint: HINT_INTERVAL[0],
      wasCold: fire.fuel <= 0.05,
      bubbleUntil: 0,
      look: { yaw: 0, pitch: 0 },
      legs: { drop: 0, back: 0 },
      lastPointerMove: -100,
      pointer: new THREE.Vector2(),
      splashAt: 0,
      paddlePhase: 0,
      carry: null, // 'wood' | 'bucket'
      tilt: 0, // how far the bucket is tipped (0..1)
      dripAt: 0,
    };
  }
  const temp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(),
    }),
    []
  );

  const now = () => clockRef.current?.elapsedTime ?? 0;
  const say = (text, seconds = 2.6, laptop = false) => {
    if (!text) return;
    state.current.bubbleUntil = now() + seconds;
    setBubble({ text, laptop });
  };
  const react = (type) => {
    const s = state.current;
    s.reaction = { type, start: now() };
    if ((type === 'wave' || type === 'cheer') && !s.riding && !s.swimming && !LOWERED.has(s.step?.act) && !LOWERED.has(s.lastAct)) s.hop = now();
  };
  const startActivity = (id, steps) => {
    const s = state.current;
    if (s.riding) return; // finish the kayak trip first
    // Interrupted while carrying something: it's back in its place
    if (s.carry === 'bucket') bucket.carried = false;
    s.carry = null;
    s.activity = id;
    s.steps = steps || ACTIVITIES[id].build(s.pos) || [];
    s.step = null;
  };
  /** Cut a nap short (tapped, or hit by something). */
  const wake = () => {
    const s = state.current;
    if (s.step?.act === 'nap') s.step = null;
  };

  // Celebrate the visitor's discoveries
  useEffect(
    () =>
      on('discover', () => {
        state.current.pending = 'cheer';
      }),
    []
  );

  // Track the mouse on the window (touch has no hover, so he just looks at the camera)
  useEffect(() => {
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      state.current.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      state.current.lastPointerMove = performance.now() / 1000;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  // Put the kayak and the bucket back if he's unmounted mid-trip
  useEffect(
    () => () => {
      kayak.driven = false;
      bucket.carried = false;
    },
    []
  );

  useFrame(({ camera, clock }, delta) => {
    clockRef.current = clock;
    const s = state.current;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const { poser, bones } = rig;
    const snap = s.snap;
    s.snap = false;

    if (bubble && t > s.bubbleUntil) setBubble(null);

    // --- Reactions and world events -------------------------------------------------
    const cold = fire.fuel <= 0.05;
    // Asleep, or putting the fire out for the night: no relighting it, no cheering
    const turnedIn = s.step?.sleepy || s.activity === 'bedtime' || isSleepTime(day.hour);
    if (cold && !s.wasCold && !turnedIn && s.activity !== 'makeFire' && !s.riding && !s.swimming) startActivity('makeFire');
    if (!cold && s.wasCold && !turnedIn && s.activity !== 'makeFire') {
      react('cheer');
      if (interactive) say(pick(LINES.cheer));
    }
    s.wasCold = cold;
    if (s.pending && !s.reaction && !s.step?.sleepy) {
      react(s.pending);
      if (interactive) say(pick(LINES.cheer));
    }
    s.pending = null;
    const nearCamp = Math.hypot(s.pos[0], s.pos[1]) < 6;
    if (interactive && nearCamp && !s.reaction && !s.riding && !s.carry && !s.step?.sleepy && t > s.nextHint && s.activity !== 'laptop') {
      react('point');
      say(pick(LINES.hint), REACTION_SECONDS.point, true);
      s.nextHint = t + THREE.MathUtils.randFloat(...HINT_INTERVAL);
    }
    if (s.reaction && t - s.reaction.start > REACTION_SECONDS[s.reaction.type]) s.reaction = null;
    const reaction = s.reaction?.type;

    // --- Step machine (paused while reacting) -----------------------------------------
    if (!reaction) {
      if (!s.step && !s.steps.length && t > s.idleUntil) startActivity(chooseActivity(s.activity, day.hour));
      if (!s.step && s.steps.length) {
        s.step = s.steps.shift();
        s.stepT = 0;
        s.tickAt = 0;
        const st = s.step;
        if (st.walk) s.route = findPath(s.pos, st.walk, { withKayak: st.withKayak !== false });
        if (st.say !== undefined) {
          if (interactive) say(st.say, st.seconds, st.laptop);
          s.step = null;
        } else if (st.run) {
          st.run();
          s.step = null;
        } else if (st.carry !== undefined) {
          if (st.carry === 'bucket') bucket.carried = true;
          else if (s.carry === 'bucket') bucket.carried = false;
          s.carry = st.carry;
          s.step = null;
        } else if (st.board) {
          Object.assign(kayak, kayak.rest, { driven: true });
          s.riding = true;
          s.rideStart = t;
          s.paddleRoute = [];
          s.step = null;
        } else if (st.paddle) s.paddleRoute = [...st.paddle];
        else if (st.unboard) {
          s.riding = false;
          kayak.driven = false;
          s.route = findPath(s.pos, st.unboard, { withKayak: false });
          s.step = { walk: st.unboard };
        }
        if (!s.step && !s.steps.length) s.idleUntil = t + THREE.MathUtils.randFloat(1.5, 3);
      }
    }
    const step = reaction ? null : s.step;
    if (step) s.stepT += dt;

    // --- Movement ---------------------------------------------------------------------
    let speed = 0;
    let yawTarget = s.yaw;
    let anchor = null;
    let anchorRate = 6;
    const surface = ISLAND.waterLevel + waveHeightAt(s.pos[0], s.pos[1]);
    const ground = terrainHeight(s.pos[0], s.pos[1]);
    const depth = isOverWater(s.pos[0], s.pos[1]) ? surface - ground : 0;
    // Start swimming past SWIM_DEPTH, stop only once it's clearly shallower,
    // so passing waves don't flip him between wading and swimming
    s.swimming = !s.riding && depth > (s.swimming ? SWIM_DEPTH - 0.2 : SWIM_DEPTH);
    // Ride a smoothed water level: the swell lifts him gently instead of every ripple jolting him
    s.waterY = s.waterY === undefined ? surface : THREE.MathUtils.damp(s.waterY, surface, 1.5, dt);
    const moveSpeed = s.swimming ? SWIM_SPEED : depth > 0.2 ? WADE_SPEED : WALK_SPEED;

    if (step?.walk) {
      const goal = s.route[0] || step.walk;
      const dx = goal[0] - s.pos[0];
      const dz = goal[1] - s.pos[1];
      const dist = Math.hypot(dx, dz);
      yawTarget = yawToward(dx, dz);
      // Finish standing up from a seat or squat before setting off
      const standing = 1 - THREE.MathUtils.smoothstep(s.legs.drop, 0.04, 0.12);
      const align = Math.max(0, Math.cos(wrap(yawTarget - s.yaw))) * standing;
      const move = Math.min(dist, moveSpeed * align * align * dt);
      if (dist > 1e-4) {
        s.pos[0] += (dx / dist) * move;
        s.pos[1] += (dz / dist) * move;
      }
      speed = move / dt;
      if (dist < 0.06) {
        s.route.shift();
        if (!s.route.length) s.step = null;
      }
    } else if (step?.face) {
      yawTarget = yawToward(step.face[0] - s.pos[0], step.face[1] - s.pos[1]);
      if (Math.abs(wrap(yawTarget - s.yaw)) < 0.08) s.step = null;
    } else if (step?.act) {
      if (step.every && s.stepT >= s.tickAt + step.every) {
        s.tickAt += step.every;
        step.tick?.(s.stepT);
      }
      if (step.anchor) {
        anchor = step.anchor;
        anchorRate = step.anchorRate ?? 6;
      }
      if (s.stepT > step.seconds || step.until?.()) s.step = null;
    } else if (step?.paddle || step?.dock) {
      // Paddle the kayak along the route, then line it back up on the beach
      const r = kayak.rest;
      const goal = step.dock ? [r.x, r.z] : s.paddleRoute[0];
      const dx = goal[0] - kayak.x;
      const dz = goal[1] - kayak.z;
      const dist = Math.hypot(dx, dz);
      const heading = step.dock && dist < 0.3 ? r.heading : Math.atan2(dx, dz);
      kayak.heading = dampAngle(kayak.heading, heading, step.dock ? 2 : 1.2, dt);
      const align = Math.max(0, Math.cos(wrap(heading - kayak.heading)));
      const move = Math.min(dist, (step.dock ? 0.6 : PADDLE_SPEED) * (0.25 + 0.75 * align) * dt);
      if (dist > 1e-4) {
        kayak.x += (dx / dist) * move;
        kayak.z += (dz / dist) * move;
      }
      if (!step.dock && dist < 0.4) {
        s.paddleRoute.shift();
        if (!s.paddleRoute.length) s.step = null;
      }
      if (step.dock && dist < 0.05 && Math.abs(wrap(r.heading - kayak.heading)) < 0.05) s.step = null;
      if (t > s.splashAt && move > 0) {
        s.splashAt = t + 0.3;
        // Wake off the stern, not under the seat (he'd bob on his own ripples)
        disturbWaves(kayak.x - Math.sin(kayak.heading) * 1.4, kayak.z - Math.cos(kayak.heading) * 1.4, 0.45, -0.03);
      }
    }
    if (s.riding) {
      // Float on the swell (or rest on the sand at either end of the trip)
      const water = isOverWater(kayak.x, kayak.z) ? ISLAND.waterLevel + waveHeightAt(kayak.x, kayak.z) - 0.08 : -Infinity;
      const floatY = Math.max(terrainHeight(kayak.x, kayak.z) - 0.04, water);
      // Smoothed like a real hull, which spans the small ripples instead of following each one
      kayak.y = t - s.rideStart < 0.1 ? floatY : THREE.MathUtils.damp(kayak.y, floatY, 2, dt);
      kayak.roll = 0.05 * Math.sin(t * 1.7);
      kayak.pitch = 0.03 * Math.sin(t * 1.3 + 1);
      // Seat well, in the kayak's frame (bow along +Z)
      const sx = Math.sin(kayak.heading);
      const sz = Math.cos(kayak.heading);
      anchor = [kayak.x - sx * 0.1, kayak.y + 0.31, kayak.z - sz * 0.1];
      anchorRate = 6;
      yawTarget = kayakYaw(kayak.heading);
    }

    // Turn toward the visitor (or the laptop) to react, unless seated or kneeling
    const lowered = s.riding || s.swimming || LOWERED.has(step?.act) || LOWERED.has(s.lastAct);
    if (reaction && !lowered) {
      const to = reaction === 'point' ? temp.v.set(...LAPTOP_FOCUS) : camera.position;
      yawTarget = yawToward(to.x - s.pos[0], to.z - s.pos[1]);
    }
    const aboard = s.riding && t - s.rideStart > 0.8;
    s.yaw = aboard ? yawTarget : dampAngle(s.yaw, yawTarget, 7, dt);
    const turning = Math.abs(wrap(yawTarget - s.yaw)) > 0.1;

    // Hips pinned (kneeling, a seat, the bed, the kayak): put the feet (the root) where the legs reach from there
    const fx = Math.cos(s.yaw);
    const fz = -Math.sin(s.yaw);
    if (anchor) {
      // Settle in at the step's pace; once aboard the kayak, ride along exactly
      const k = snap || aboard ? 1 : 1 - Math.exp(-anchorRate * dt);
      s.pos[0] += (anchor[0] + fx * s.legs.back - s.pos[0]) * k;
      s.pos[1] += (anchor[2] + fz * s.legs.back - s.pos[1]) * k;
    }
    const groundY = terrainHeight(s.pos[0], s.pos[1]);
    let rootY = s.swimming ? s.waterY - SWIM_DEPTH : groundY;
    if (anchor) rootY = anchor[1] - (poser.hipHeight - s.legs.drop);
    // Eased, so getting up from a seat or out of bed doesn't jolt
    s.y = snap || aboard ? rootY : THREE.MathUtils.damp(s.y, rootY, anchor ? anchorRate * 1.3 : 20, dt);

    // Ripples and splashes while wading or swimming
    if ((s.swimming || depth > 0.15) && speed > 0.05 && t > s.splashAt) {
      s.splashAt = t + (s.swimming ? 0.55 : 0.4);
      // Ripples behind him, not under him (he'd bob on his own ripples)
      disturbWaves(s.pos[0] - fx * 0.7, s.pos[1] - fz * 0.7, s.swimming ? 0.45 : 0.3, s.swimming ? -0.035 : -0.02);
      if (s.swimming) emitBurst({ position: [s.pos[0] + fx * 0.4, surface + 0.05, s.pos[1] + fz * 0.4], count: 6, color: WATER, speed: 0.6, up: 0.9, gravity: 6, life: 0.5, size: 0.012 });
    }

    // --- Pose -------------------------------------------------------------------------
    const walking = (step?.walk && speed > 0.02) || turning;
    s.walkAmt = THREE.MathUtils.damp(s.walkAmt, walking && !s.riding && !s.swimming ? Math.min(1, 0.45 + speed / WALK_SPEED) : 0, 8, dt);
    s.phase += (Math.max(speed, turning ? 0.5 : 0) / STRIDE) * Math.PI * 2 * dt + (s.swimming ? 2.4 * dt : 0);
    let poseName = 'stand';
    if (s.riding) poseName = 'kayak';
    else if (s.swimming) poseName = 'swim';
    else if (step?.act) poseName = step.act;
    else if (LOWERED.has(s.lastAct) && !step) poseName = s.lastAct; // stay put between steps
    s.lastAct = step?.act || (step ? null : s.lastAct);
    if (step?.walk || step?.face) s.lastAct = null;

    // Carrying something while walking or standing: the arms hold it
    const carrying = s.carry && !step?.act ? POSES[s.carry === 'wood' ? 'carryWood' : 'carryBucket'] : null;
    let target = combine(POSES[poseName] || POSES.stand, step?.pose, carrying);
    let motion = step?.motion ? step.motion(s.stepT) : null;
    if (s.riding) {
      s.paddlePhase += dt * (step?.paddle || step?.dock ? 2.8 : 0.6);
      motion = paddleStroke(s.paddlePhase);
    } else if (s.swimming) motion = swimStroke(s.phase);
    if (reaction) {
      // Arms full: he just turns and talks
      const gesture = s.carry ? null : reaction === 'point' ? pointPose(poser) : POSES[reaction];
      target = combine(lowered ? POSES[poseName] : POSES.stand, carrying, gesture);
      if (reaction === 'wave') motion = waveMotion(t);
      else if (reaction === 'cheer') motion = cheerMotion(t);
      else motion = null;
      if (s.riding || s.carry) motion = null;
    }
    const sleepy = !!step?.sleepy;
    // Breathing, slow and deep when asleep
    const breathe = reducedMotion ? null : { chest: { swing: sleepy ? 0.03 * Math.sin(t * 1.3) : 0.015 * Math.sin(t * 2.1) } };

    // Head: what the step looks at, a carried prop, the cursor, or the camera (eyes shut when asleep)
    const lookAt = lookTarget(s, step, reaction, camera, interactive, temp);
    const head = temp.w.set(s.pos[0] - fx * s.legs.back, s.y + HEIGHT * 0.88 - s.legs.drop, s.pos[1] - fz * s.legs.back);
    const lx = lookAt.x - head.x;
    const ly = lookAt.y - head.y;
    const lz = lookAt.z - head.z;
    // Into the body's frame: forward is (fx, fz); his left is (fz, -fx) (the model's -Z side)
    const fwd = lx * fx + lz * fz;
    const left = lx * fz - lz * fx;
    let yaw = Math.atan2(left, fwd);
    if (Math.abs(yaw) > 2.2 || sleepy) yaw = 0; // behind him: don't crane round
    const pitch = sleepy ? 0 : THREE.MathUtils.clamp(Math.atan2(ly, Math.hypot(fwd, left)), -0.6, 0.5);
    s.look.yaw = THREE.MathUtils.damp(s.look.yaw, THREE.MathUtils.clamp(yaw, -1.15, 1.15), 6, dt);
    s.look.pitch = THREE.MathUtils.damp(s.look.pitch, pitch, 6, dt);
    const look = {
      neck: { swing: 0.35 * s.look.pitch, turn: 0.35 * s.look.yaw },
      head: { swing: 0.65 * s.look.pitch, turn: 0.65 * s.look.yaw },
    };

    // Place him (with last frame's leg offsets) before posing, so the bones use this frame's body axes
    let hop = 0;
    if (s.hop >= 0 && !reducedMotion) {
      const h = (t - s.hop) / 0.55;
      if (h >= 1) s.hop = -1;
      else hop = Math.sin(h * Math.PI) * 0.16;
    }
    root.current.position.set(s.pos[0], s.y, s.pos[1]);
    root.current.rotation.y = s.yaw;
    body.current.position.set(-s.legs.back, -s.legs.drop + hop + walkBob(s.phase, s.walkAmt), 0);
    const walk = walkCycle(s.phase, s.walkAmt);
    // Hands full: no arm swing on that side
    if (s.carry === 'wood') {
      delete walk.arm_L;
      delete walk.arm_R;
    } else if (s.carry === 'bucket') delete walk.arm_R;
    const extra = addAngles(walk, motion, breathe, look);
    s.legs = poser.update(target, extra, snap ? 1e3 : reaction === 'flinch' ? 14 : 6, dt);

    // --- What he holds ------------------------------------------------------------------
    // The paddle runs through both palms, so it stays in his grip whatever the arms do
    const p = paddle.current;
    p.visible = s.riding;
    if (s.riding) {
      const a = body.current.worldToLocal(palmPosition(bones, 'L', temp.v));
      const b = body.current.worldToLocal(palmPosition(bones, 'R', temp.w));
      p.position.copy(a).add(b).multiplyScalar(0.5);
      p.quaternion.setFromUnitVectors(PADDLE_AXIS, b.sub(a).normalize());
    }

    // Firewood across the forearms, logs running from hand to hand
    const wood = armful.current;
    wood.visible = s.carry === 'wood';
    if (wood.visible) {
      const a = palmPosition(bones, 'L', temp.a);
      const c = palmPosition(bones, 'R', temp.c);
      const across = temp.v.subVectors(c, a).normalize();
      const up = temp.w.copy(UP).addScaledVector(across, -across.dot(UP)).normalize();
      const out = temp.b.crossVectors(up, across);
      wood.quaternion.setFromRotationMatrix(temp.m.makeBasis(out, up, across));
      // Resting on the forearms, a little in from the hands
      wood.position.addVectors(a, c).multiplyScalar(0.5).addScaledVector(up, 0.045).addScaledVector(out, -0.07);
    }

    // The bucket hangs from his right hand; it fills in the sea and tips out over the fire
    const pail = carriedBucket.current;
    pail.visible = s.carry === 'bucket';
    const pouring = step?.pour && s.carry === 'bucket';
    s.tilt = THREE.MathUtils.damp(s.tilt, pouring && s.stepT > 0.6 ? 1 : 0, 3, dt);
    if (pail.visible) {
      const hand = palmPosition(bones, 'R', temp.a);
      const right = temp.v.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      pail.quaternion.setFromAxisAngle(right, -s.tilt * POUR_TILT).multiply(temp.q.setFromAxisAngle(UP, s.yaw));
      pail.position.copy(hand).sub(temp.w.set(0, HANDLE, 0).applyQuaternion(pail.quaternion));
      if (step?.fill && s.stepT > 0.7) {
        if (bucket.water === 0) {
          // In it goes: a splash, and rings spreading from the bucket
          disturbWaves(pail.position.x, pail.position.z, 0.3, -0.06);
          emitBurst({ position: [pail.position.x, ISLAND.waterLevel + 0.05, pail.position.z], count: 10, color: WATER, speed: 0.5, up: 0.8, gravity: 6, life: 0.5, size: 0.01 });
        }
        bucket.water = Math.min(1, bucket.water + dt / FILL_SECONDS);
      }
      if (pouring && s.tilt > 0.6 && bucket.water > 0) {
        bucket.water = Math.max(0, bucket.water - dt / POUR_SECONDS);
        if (t > s.dripAt) {
          s.dripAt = t + 0.05;
          // From the front of the rim, now the lowest point
          const rim = temp.b.set(BUCKET.top, BUCKET.height, 0).applyQuaternion(pail.quaternion).add(pail.position);
          emitBurst({ position: rim, count: 4, color: WATER, speed: 0.25, up: 0.1, gravity: 9.8, life: 0.55, size: 0.012 });
        }
        if (bucket.water <= 0 && fire.fuel > 0) {
          fire.dousedBySira = true;
          fire.doused = true;
        }
      }
      const water = bucketWater.current;
      water.visible = bucket.water > 0.02 && s.tilt < 0.4;
      water.position.y = 0.02 + bucket.water * (BUCKET.height - 0.05);
    }

    // --- Bubble, Z's and the tap target follow his body (seated, kneeling or in bed) ---------
    const headPos = bones.head.getWorldPosition(temp.a);
    overHead.current.position.set(headPos.x, headPos.y + 0.6, headPos.z);
    if (sleepy !== snoozing) setSnoozing(sleepy);
    const feet = bones.foot_L.getWorldPosition(temp.b).add(bones.foot_R.getWorldPosition(temp.c)).multiplyScalar(0.5);
    const crown = headPos.addScaledVector(temp.v.subVectors(headPos, bones.neck.getWorldPosition(temp.v)).normalize(), 0.3);
    const hit = hitArea.current;
    hit.position.addVectors(feet, crown).multiplyScalar(0.5);
    const span = temp.w.subVectors(crown, feet);
    hit.scale.set(1, Math.max(0.3, span.length() / HEIGHT), 1);
    hit.quaternion.setFromUnitVectors(UP, span.normalize());

    collider.current?.setNextKinematicTranslation({ x: s.pos[0], y: s.y, z: s.pos[1] });
  });

  const handleTap = (e) => {
    // Ignore clicks that were really camera drags
    if (!interactive || e.delta > 6) return;
    e.stopPropagation();
    const s = state.current;
    s.taps += 1;
    if (s.step?.act === 'sleep') {
      // Asleep for the night: he mumbles, stirs, and on the third tap gets up (to light the fire and sit up)
      const t = now();
      s.wakeTaps = t - (s.lastWakeTap ?? -Infinity) < WAKE_TAP_GAP ? (s.wakeTaps || 0) + 1 : 1;
      s.lastWakeTap = t;
      if (s.wakeTaps >= WAKE_TAPS) {
        s.wakeTaps = 0;
        startActivity('woken');
        say(pick(LINES.awake));
      } else say(pick(s.wakeTaps === 1 ? LINES.sleepy : LINES.stirring));
      return;
    }
    if (s.step?.act === 'nap') {
      wake();
      react('wave');
      say(pick(LINES.woken));
      return;
    }
    // Every third tap he shows the way to the laptop instead of waving
    if (s.taps % 3 === 0) {
      react('point');
      const away = Math.hypot(s.pos[0], s.pos[1]) > 6;
      say(pick(away ? LINES.hintAway : LINES.hint), REACTION_SECONDS.point, !away);
    } else {
      react('wave');
      say(pick(LINES.hello));
    }
  };

  const handleHit = ({ other }) => {
    const v = other.rigidBody?.linvel();
    const s = state.current;
    if (!v || Math.hypot(v.x, v.y, v.z) < FLINCH_SPEED || s.reaction?.type === 'flinch' || s.step?.act === 'sleep') return;
    const napping = s.step?.act === 'nap';
    wake();
    react('flinch');
    if (interactive) say(pick(napping ? LINES.startled : LINES.ouch), 1.6);
  };

  const [x, , z] = LAYOUT.likeness.position;
  return (
    <>
      {/* Body-sized capsule following him around, so tossed props bounce off (and make him flinch) */}
      <RigidBody ref={collider} type="kinematicPosition" colliders={false} position={[x, 0, z]} onCollisionEnter={handleHit}>
        <CapsuleCollider args={[HEIGHT * 0.32, 0.2]} position={[0, HEIGHT / 2, 0]} />
      </RigidBody>
      <group ref={root} position={[x, 0, z]}>
        <group ref={body}>
          <primitive object={rig.model} />
          <Paddle ref={paddle} />
        </group>
      </group>
      <Armful ref={armful} />
      <group ref={carriedBucket} visible={false}>
        <BucketModel waterRef={bucketWater} />
      </group>
      {/* Invisible hit area from his feet to the top of his head: cheaper and steadier to click than the skinned mesh */}
      <mesh
        ref={hitArea}
        onClick={handleTap}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <capsuleGeometry args={[0.24, HEIGHT - 0.48, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <group ref={overHead}>
        {interactive && <SpeechBubble text={bubble?.text} onSelect={bubble?.laptop ? onSelectLaptop : null} />}
        {interactive && <Snooze visible={snoozing && !bubble} />}
      </group>
    </>
  );
};

/** The arm on the laptop's side pointing at it (a little above, so the straight arm reads as pointing). */
const POINT_AT = new THREE.Vector3(...LAPTOP_FOCUS).add(new THREE.Vector3(0, 0.35, 0));
const pointPose = (poser) => {
  const side = poser.sideToward(POINT_AT);
  return { [`arm_${side}`]: { dir: poser.aimDir(POINT_AT, side), rot: 0.15, flex: 0.08 } };
};

/** Where his head should point (a world position). */
const lookTarget = (s, step, reaction, camera, interactive, temp) => {
  const grab = [...held].find((h) => h.target);
  if (reaction === 'point') return temp.v.set(...LAPTOP_FOCUS);
  if (reaction) return camera.position;
  if (grab) return grab.target;
  if (step?.look) {
    const l = typeof step.look === 'function' ? step.look(s.stepT) : step.look;
    if (l === 'camera') return camera.position;
    return temp.v.set(...l);
  }
  if (step?.walk && s.route[0]) {
    // Ahead along the route, at eye height
    return temp.v.set(s.route[0][0], s.y + HEIGHT * 0.85, s.route[0][1]);
  }
  if (s.riding) return temp.v.set(kayak.x + Math.sin(kayak.heading) * 5, kayak.y + 1, kayak.z + Math.cos(kayak.heading) * 5);
  if (interactive && performance.now() / 1000 - s.lastPointerMove < POINTER_IDLE) {
    // Where the cursor ray crosses a plane part-way to the camera: he follows
    // the cursor but keeps his face toward the visitor instead of staring down at it
    temp.ray.setFromCamera(s.pointer, camera);
    const head = temp.w.set(s.pos[0], s.y + HEIGHT * 0.88, s.pos[1]);
    const mid = head.clone().lerp(camera.position, 0.45);
    camera.getWorldDirection(temp.plane.normal);
    temp.plane.setFromNormalAndCoplanarPoint(temp.plane.normal.negate(), mid);
    return temp.ray.ray.intersectPlane(temp.plane, temp.v) || camera.position;
  }
  return camera.position;
};

export default Likeness;
