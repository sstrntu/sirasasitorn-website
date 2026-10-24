/*
 * Procedural posing for Sira's skeleton.
 *
 * Torso, head and legs turn about the character's own body axes, never by
 * "shortest arc" aiming, so they can't roll sideways:
 *   swing - about the body's right axis: legs swing forward (positive), the
 *           torso and head tip back (positive) / forward (negative)
 *   out   - about the body's forward axis: legs move out to the side (positive)
 *   turn  - about the body's up axis: toward the character's left (positive)
 *
 * Arms are anatomical, so every pose and every blend between poses is one a
 * real arm can make (an elbow can't bend backwards or sideways):
 *   dir   - where the upper arm points, in the chest's frame: [forward, up, outward]
 *   rot   - upper-arm rotation about its own length; positive turns the front of
 *           the arm outward (with the elbow bent and the arm out to the side, it
 *           lifts the forearm up)
 *   flex  - elbow bend, 0 (straight) .. 2.4; the forearm folds toward the front
 *   pron  - forearm turn; positive turns the palm down / back
 *   wrist - wrist bend; positive toward the palm
 *   reach - instead of dir/rot/flex: put the palm on a point, with the elbow
 *           bending out (two-bone IK). Either a world point [x, y, z], or
 *           [bone, forward, up, right] (m from that bone, in the chest's frame;
 *           add 'level' as a fifth item to use the upright body's frame instead)
 * The shoulder (collarbone) lifts on its own as the arm rises overhead.
 *
 * Pose keys without a side (`thigh`, `arm`) apply to both sides, mirrored; keys
 * with a side (`arm_L`) are used as given.
 */
import * as THREE from 'three';

/** Bones posed by body-axis angles, parents before children. */
const BODY = ['hips', 'spine', 'chest', 'neck', 'head', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];
const ARM_BONES = ['shoulder', 'upperarm', 'forearm', 'hand'];
const SIDES = ['L', 'R'];
const LEG = /^(thigh|shin|foot)$/;

/** Relaxed arms: hanging close to the body, elbows slightly bent. Also the default for any arm a pose leaves out. */
const ARM_REST = { dir: [0.05, -1, 0.12], rot: 0, flex: 0.2, pron: 0, wrist: 0 };
const ARM_SCALARS = ['rot', 'flex', 'pron', 'wrist'];
const MAX_FLEX = 2.4;

/*
 * Hip joint heights (m), measured on the rig, for poses that rest on something
 * rather than stand on their feet: <Likeness /> pins the hips there (`anchor`).
 */
/** Kneeling: knees and shins on the ground. */
export const KNEEL_HIP = 0.31;
/** Sitting: above the seat (the seat of his shorts rests on it). */
export const SIT_HIP = 0.09;
/** Lying on his side: above what he lies on. */
export const LIE_HIP = 0.155;

/** Kneeling up straight: knees and shins on the ground, toes pointing back. */
const KNEEL = { thigh: { swing: 0.14, out: 0.05 }, shin: { swing: -1.71 }, foot: { swing: -1.3 } };
/** Down on the right knee, the left knee up with that foot flat. */
const ONE_KNEE = {
  thigh_L: { swing: 1.67, out: 0.15 },
  shin_L: { swing: -1.67 },
  thigh_R: { swing: 0.14, out: -0.05 },
  shin_R: { swing: -1.71 },
  foot_R: { swing: -1.3 },
};
/** Left hand resting on the raised left knee. */
const HAND_ON_KNEE = { reach: ['shin_L', 0.02, 0.07, 0], pron: 0.9 };
/** Right hand resting on the belly. */
const HAND_ON_BELLY = { reach: ['spine', 0.18, 0.07, -0.02], pron: 0.6 };

/** Static poses. Arms follow the chest, so a leaning torso carries them with it. */
export const POSES = {
  stand: { arm: ARM_REST },
  // Down on one knee by the fire: left hand on the raised knee, right hand free to poke the fire
  crouch: {
    ...ONE_KNEE,
    spine: { swing: -0.3 },
    chest: { swing: -0.1 },
    arm_L: HAND_ON_KNEE,
    arm_R: { dir: [1, -0.3, 0.12], flex: 0.35, pron: 0.3 },
  },
  // Kneeling up straight, hands on the thighs (getting into and out of the tent)
  kneel: { ...KNEEL, arm: { dir: [0.35, -0.93, 0.12], flex: 0.5, pron: 0.6 } },
  // Kneeling at the low table, leaning in to the keys (the activity puts the hands on them)
  type: { ...KNEEL, spine: { swing: -0.25 }, chest: { swing: -0.08 }, arm: { dir: [1, -0.45, 0.05], flex: 0.7, pron: 1.1 } },
  // On the log, hands resting on the knees
  // On the log, leaning in to the fire with his hands held out to it (his arms are short for
  // his body: resting them on his knees would pull them straight and drag his shoulders down)
  sit: {
    thigh: { swing: 1.33, out: 0.24 },
    shin: { swing: -1.13 },
    spine: { swing: -0.22 },
    chest: { swing: -0.1 },
    arm: { dir: [0.85, -0.38, 0.18], flex: 0.4, pron: 1.2, wrist: -0.35 },
  },
  // Striking the flint over the tinder: both hands low in front of him
  strike: {
    ...ONE_KNEE,
    spine: { swing: -0.45 },
    chest: { swing: -0.15 },
    arm_L: { reach: ['hips', 0.42, -0.1, -0.03, 'level'], pron: 0.4 },
    arm_R: { reach: ['hips', 0.4, -0.04, 0.05, 'level'], pron: 0.9 },
  },
  // Bent low, blowing the first flames into life
  blow: {
    ...ONE_KNEE,
    spine: { swing: -0.6 },
    chest: { swing: -0.25 },
    head: { swing: 0.3 },
    arm_L: HAND_ON_KNEE,
    arm_R: { reach: ['hips', 0.3, -0.24, 0.16, 'level'], pron: 1.2 },
  },
  // Picking something up off the ground with both hands (an armful of firewood, the bucket)
  pickup: {
    ...ONE_KNEE,
    spine: { swing: -0.5 },
    chest: { swing: -0.2 },
    arm_L: { reach: ['hips', 0.42, -0.16, -0.12, 'level'], pron: -0.6 },
    arm_R: { reach: ['hips', 0.42, -0.16, 0.12, 'level'], pron: -0.6 },
  },
  // Firewood held across both forearms, palms up
  carryWood: {
    arm_L: { reach: ['spine', 0.3, 0.04, -0.13], pron: -1.1 },
    arm_R: { reach: ['spine', 0.3, 0.04, 0.13], pron: -1.1 },
  },
  // The bucket hanging from the right hand
  carryBucket: { arm_R: { dir: [0.05, -1, 0.28], flex: 0.08, pron: 0.3 } },
  // Dipping the bucket in the sea
  scoop: {
    ...ONE_KNEE,
    spine: { swing: -0.45 },
    chest: { swing: -0.15 },
    arm_L: HAND_ON_KNEE,
    arm_R: { reach: ['hips', 0.42, -0.08, 0.18, 'level'], pron: 0.3 },
  },
  // Holding the bucket out over the fire (it tips on its own as he pours)
  pour: {
    spine: { swing: -0.12 },
    arm_R: { reach: ['chest', 0.42, -0.12, 0.12], pron: 0.4 },
    arm_L: { reach: ['chest', 0.4, -0.3, -0.02], pron: -0.8 },
  },
  // Napping slouched in the beach chair: the pelvis tipped well back (that's what reclines
  // him) with the back gently rounded against the reclined backrest, not arched; head rolled to
  // one side; legs stretched out, heels resting on the ground and toes falling up and open; one
  // hand on the belly, the other arm hanging loose off the side of the chair
  nap: {
    hips: { swing: 0.6 },
    thigh_L: { swing: 1.11, out: 0.16 },
    shin_L: { swing: -0.79 },
    foot_L: { swing: 0.42, turn: 0.25 },
    thigh_R: { swing: 1.18, out: -0.12 },
    shin_R: { swing: -0.94 },
    foot_R: { swing: 0.34, turn: -0.2 },
    spine: { swing: -0.04 },
    chest: { swing: -0.08 },
    neck: { swing: 0.05 },
    head: { swing: -0.08, out: 0.35, turn: 0.3 },
    arm_L: { reach: ['hips', 0.02, 0.0, -0.37, 'level'], pron: 0.2 },
    arm_R: HAND_ON_BELLY,
  },
  // Asleep on his side, curled up (lying straight, his feet went through the back of the
  // tent): he tips back from the hips and rolls about his length (`out`) onto his side. Poses
  // turn about the upright body's axes, so lying on his side, bending toward his front is a
  // `turn` about the vertical: knees drawn up, back gently rounded, chin tucked; the arms (posed
  // in the chest's own frame) fold in front of his chest
  sleep: {
    hips: { swing: Math.PI / 2, out: -Math.PI / 2 },
    thigh_L: { turn: 1.75 },
    // The top leg rests down on the lower one (swing, which comes before the turn, tips it down)
    thigh_R: { swing: -0.26, turn: 1.7 },
    shin_L: { turn: -1.15 },
    shin_R: { swing: -0.08, turn: -1.1 },
    spine: { turn: -0.18 },
    chest: { turn: -0.1 },
    head: { turn: -0.25 },
    arm: { dir: [0.85, -0.35, 0.05], flex: 1.5, pron: 0.5, wrist: 0.3 },
  },
  stretch: { arm: { dir: [0.05, 1, 0.32], rot: 0.3, flex: 0.15 }, spine: { swing: 0.12 }, head: { swing: 0.25 } },
  // Pushing a palm trunk to shake its coconuts loose
  shake: { arm: { dir: [1, 0.35, 0.3], rot: 0.2, flex: 0.35 }, spine: { swing: -0.1 } },
  // In the kayak: legs forward under the deck, knees a little bent, toes pointed; hands on the paddle shaft
  kayak: {
    thigh: { swing: 1.4, out: 0.1 },
    shin: { swing: -0.2 },
    foot: { swing: -0.6 },
    spine: { swing: -0.05 },
    arm: { dir: [1, -0.2, 0.18], flex: 0.6, pron: 0.9 },
  },
  // Breaststroke, leaning into the water (the stroke itself is swimStroke)
  swim: { spine: { swing: -0.45 }, head: { swing: 0.4 }, arm: { dir: [1, 0, 0.15], flex: 0.3, pron: 1.0 } },
  // Hand up beside the head, palm out: the upper arm forward and out, a little below the
  // shoulder, which needs about half the twist of an arm straight out to the side (the twist
  // and the raised arm wring the sleeve into the shirt)
  wave: { arm_L: { dir: [0.55, -0.2, 0.8], rot: 0.8, flex: 1.75 } },
  cheer: { arm: { dir: [0.12, 1, 0.5], rot: 0.35, flex: 0.35 } },
  // Hands up to guard the face
  flinch: { arm: { dir: [0.8, 0.3, 0.35], rot: -0.35, flex: 1.95 }, spine: { swing: 0.2 } },
  // Hugging himself
  cold: { arm: { dir: [0.55, -0.7, 0.02], rot: -0.6, flex: 2.0 }, chest: { swing: -0.12 } },
};

const expand = (pose) => {
  const out = {};
  Object.entries(pose || {}).forEach(([key, a]) => {
    if (key === 'arm') {
      out.arm_L = { ...out.arm_L, ...a };
      out.arm_R = { ...out.arm_R, ...a };
    } else if (LEG.test(key)) {
      out[`${key}_L`] = { ...out[`${key}_L`], ...a };
      out[`${key}_R`] = { ...out[`${key}_R`], ...a, out: -(a.out || 0), turn: -(a.turn || 0) };
    } else out[key] = { ...out[key], ...a };
  });
  return out;
};

/** Merge pose layers: later layers replace earlier ones bone by bone (or arm by arm). */
export const combine = (...layers) => Object.assign({}, ...layers.map(expand));

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _d = new THREE.Vector3();
const _v = new THREE.Vector3();
const _target = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
/** Palm centre past the wrist (m), along the forearm. */
const PALM = 0.07;
/** Reaching elbows bend out, down and a little back. */
const POLE = [-0.3, -0.5, 0.8];

const rotate = (bone, axis, angle) => {
  if (Math.abs(angle) < 1e-5) return;
  _q.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_qw).premultiply(_q);
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw));
  bone.updateMatrixWorld(true);
};

/** `v` with its component along unit vector `n` removed, normalized. */
const perpendicular = (v, n) => v.clone().addScaledVector(n, -v.dot(n)).normalize();

/**
 * Drives the bones of a cloned rig. `model` is the (scaled, not yet parented)
 * model root, `bones` maps bone names to bones; `height` is the real height the
 * model is scaled to.
 */
export const createPoser = (model, bones, height) => {
  const all = [...BODY, ...SIDES.flatMap((s) => ARM_BONES.map((b) => `${b}_${s}`))];
  const rest = new Map(all.map((n) => [n, bones[n].quaternion.clone()]));
  const current = Object.fromEntries(BODY.map((n) => [n, { swing: 0, out: 0, turn: 0 }]));

  // Rest-pose measurements in the model's own frame (it isn't parented yet)
  model.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  const pos = (n) => bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel);
  const quat = (n) => bones[n].getWorldQuaternion(new THREE.Quaternion());
  const thighLen = pos('thigh_L').distanceTo(pos('shin_L')) * height;
  const shinLen = pos('shin_L').distanceTo(pos('foot_L')) * height;
  const chestRestInv = quat('chest').invert();
  const armRig = Object.fromEntries(
    SIDES.map((s) => {
      const U0 = quat(`upperarm_${s}`);
      const F0 = quat(`forearm_${s}`);
      const upperDir = pos(`forearm_${s}`).sub(pos(`upperarm_${s}`)).normalize();
      const foreDir = pos(`hand_${s}`).sub(pos(`forearm_${s}`)).normalize();
      // The elbow hinges about the body's left-right axis (palms face the thighs at rest);
      // the wrist bends toward the palm, about the front-back axis
      const hingeModel = perpendicular(Z, upperDir);
      const hinge = hingeModel.clone().applyQuaternion(U0.clone().invert());
      const wristAxis = perpendicular(X, foreDir).applyQuaternion(F0.clone().invert());
      const foreAxis = foreDir.clone().applyQuaternion(F0.clone().invert());
      const lift = X.clone().applyQuaternion(chestRestInv);
      // Which way the forearm folds at rest (forward), and the arm's lengths (m) for reaching
      const fold = new THREE.Vector3().crossVectors(hingeModel, upperDir).normalize();
      const upperLen = pos(`forearm_${s}`).distanceTo(pos(`upperarm_${s}`)) * height;
      const foreLen = pos(`hand_${s}`).distanceTo(pos(`forearm_${s}`)) * height + PALM;
      return [s, { U0, upperDir, hinge, wristAxis, foreAxis, lift, fold, upperLen, foreLen }];
    })
  );
  const arms = Object.fromEntries(
    SIDES.map((s) => [s, { dir: new THREE.Vector3(...ARM_REST.dir).normalize(), rot: 0, flex: ARM_REST.flex, pron: 0, wrist: 0 }])
  );
  const chestToModel = new THREE.Quaternion(); // last frame's chest rotation (world, relative to rest)
  const levelQ = new THREE.Quaternion(); // the upright body's frame (the model root's world rotation)
  const axes = { right: new THREE.Vector3(), up: new THREE.Vector3(), forward: new THREE.Vector3() };

  /** Hip drop and how far the hips sit behind the ankle for thigh swing `a` and knee swing `b`. */
  const legOffset = (a, b) => {
    const x = thighLen * Math.sin(a) + shinLen * Math.sin(a + b);
    const y = thighLen * Math.cos(a) + shinLen * Math.cos(a + b);
    return { drop: thighLen + shinLen - y, back: x };
  };

  const poseArm = (s, c, e) => {
    const sign = s === 'L' ? -1 : 1; // the left arm hangs on the model's -Z side
    const r = armRig[s];
    _d.copy(c.dir);
    if (e.dir) _d.add(_v.fromArray(e.dir));
    _d.normalize();
    const elevation = _d.y;
    _d.z *= sign;
    const rot = c.rot + (e.rot || 0);
    const flex = THREE.MathUtils.clamp(c.flex + (e.flex || 0), 0, MAX_FLEX);
    const pron = c.pron + (e.pron || 0);
    const wrist = c.wrist + (e.wrist || 0);

    // Collarbone lifts once the arm goes above shoulder height
    const shoulder = bones[`shoulder_${s}`];
    const shrug = 0.3 * THREE.MathUtils.smoothstep(elevation, 0.15, 0.95);
    shoulder.quaternion.copy(rest.get(`shoulder_${s}`)).premultiply(_q.setFromAxisAngle(r.lift, -sign * shrug));
    shoulder.updateMatrixWorld(true);

    // Upper arm: swing from rest to `dir`, rotate about its length, then carry with the chest
    _q.setFromUnitVectors(r.upperDir, _d);
    _q2.setFromAxisAngle(_d, sign * rot);
    _qw.copy(chestToModel).multiply(_q2).multiply(_q).multiply(r.U0);
    const upper = bones[`upperarm_${s}`];
    upper.quaternion.copy(shoulder.getWorldQuaternion(_qp).invert().multiply(_qw));
    // Elbow: a hinge only. Hand: forearm turn and wrist bend.
    bones[`forearm_${s}`].quaternion.copy(rest.get(`forearm_${s}`)).premultiply(_q.setFromAxisAngle(r.hinge, flex));
    bones[`hand_${s}`].quaternion
      .copy(rest.get(`hand_${s}`))
      .premultiply(_q.setFromAxisAngle(r.wristAxis, sign * wrist))
      .premultiply(_q2.setFromAxisAngle(r.foreAxis, -sign * pron));
    upper.updateMatrixWorld(true);
  };

  /** World point for a `reach` spec (see the header). */
  const reachPoint = (spec, out) => {
    if (typeof spec[0] === 'number') return out.fromArray(spec);
    const [name, forward, up, right, frame] = spec;
    return bones[name].getWorldPosition(out).add(_v.set(forward, up, right).applyQuaternion(frame === 'level' ? levelQ : chestToModel));
  };

  /** dir/rot/flex that put that palm on a `reach` spec, the elbow bending toward `pole` ([forward, up, outward]). */
  const reach = (spec, s, pole = POLE) => {
    const r = armRig[s];
    const sign = s === 'L' ? -1 : 1;
    reachPoint(spec, _target);
    bones[`upperarm_${s}`].getWorldPosition(_shoulder);
    // In the chest's rest frame (the frame `dir` is given in), not mirrored
    const v = _target.sub(_shoulder).applyQuaternion(_q.copy(chestToModel).invert());
    const a = r.upperLen;
    const b = r.foreLen;
    const d = THREE.MathUtils.clamp(v.length(), Math.abs(a - b) + 0.01, a + b - 0.005);
    v.normalize();
    // Law of cosines: the elbow bend, and how far the upper arm points off the line to the target
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    const off = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const toward = perpendicular(_axis.set(pole[0], pole[1], pole[2] * sign), v);
    const upper = v.clone().multiplyScalar(Math.cos(off)).addScaledVector(toward, Math.sin(off));
    // Turn the upper arm about its length until the forearm folds toward the target
    const fold = r.fold.clone().applyQuaternion(_q2.setFromUnitVectors(r.upperDir, upper));
    const want = perpendicular(v.multiplyScalar(d).addScaledVector(upper, -a), upper);
    const turn = Math.atan2(_d.crossVectors(fold, want).dot(upper), fold.dot(want));
    return { dir: [upper.x, upper.y, upper.z * sign], rot: turn * sign, flex };
  };

  /**
   * Blend toward `target` (a combined pose) at `rate`, add the `extra` offsets on
   * top (walk cycle, head look, small motions), and pose the skeleton.
   * Returns the hip drop and back-shift for the blended legs.
   */
  const update = (target, extra, rate, dt) => {
    const k = 1 - Math.exp(-rate * dt);
    BODY.forEach((n) => {
      const c = current[n];
      const t = target[n] || {};
      c.swing += ((t.swing || 0) - c.swing) * k;
      c.out += ((t.out || 0) - c.out) * k;
      c.turn += ((t.turn || 0) - c.turn) * k;
    });

    all.forEach((n) => bones[n].quaternion.copy(rest.get(n)));
    model.updateWorldMatrix(true, true);
    const q = model.getWorldQuaternion(levelQ);
    axes.right.set(0, 0, 1).applyQuaternion(q);
    axes.up.set(0, 1, 0).applyQuaternion(q);
    axes.forward.set(1, 0, 0).applyQuaternion(q);
    BODY.forEach((n) => {
      const c = current[n];
      const e = extra[n] || {};
      const bone = bones[n];
      rotate(bone, _axis.copy(axes.right), c.swing + (e.swing || 0));
      rotate(bone, _axis.copy(axes.forward), c.out + (e.out || 0));
      rotate(bone, _axis.copy(axes.up), c.turn + (e.turn || 0));
    });

    chestToModel.copy(bones.chest.getWorldQuaternion(_q)).multiply(chestRestInv);
    // Arms blend after the body is posed, so reaches aim from where the shoulders are now
    SIDES.forEach((s) => {
      const c = arms[s];
      const t = { ...ARM_REST, ...target[`arm_${s}`] };
      if (t.reach) Object.assign(t, reach(t.reach, s, t.pole));
      c.dir.lerp(_v.fromArray(t.dir).normalize(), k);
      ARM_SCALARS.forEach((key) => {
        c[key] += (t[key] - c[key]) * k;
      });
      poseArm(s, c, extra[`arm_${s}`] || {});
    });

    // The supporting (straighter) leg sets the height
    const l = legOffset(current.thigh_L.swing, current.shin_L.swing);
    const r = legOffset(current.thigh_R.swing, current.shin_R.swing);
    return l.drop < r.drop ? l : r;
  };

  /** A world point in the chest's rest frame, relative to `from` (a world position). */
  const toChest = (point, from) => _v.copy(point).sub(from).applyQuaternion(_q.copy(chestToModel).invert());

  /** Which arm is on the side of a world point. */
  const sideToward = (point) => (toChest(point, bones.chest.getWorldPosition(new THREE.Vector3())).z >= 0 ? 'R' : 'L');

  /** `dir` (forward, up, outward) pointing that arm at a world point. */
  const aimDir = (point, s) => {
    const d = toChest(point, bones[`upperarm_${s}`].getWorldPosition(new THREE.Vector3())).normalize();
    return [d.x, d.y, s === 'L' ? -d.z : d.z];
  };

  // Hip joint height (m) when standing
  const hipHeight = pos('thigh_L').y * height;
  return { update, legOffset, hipHeight, sideToward, aimDir };
};

/** World position of a palm: a little past the wrist, along the forearm. */
export const palmPosition = (bones, side, out) => {
  const wrist = bones[`hand_${side}`].getWorldPosition(out);
  const elbow = bones[`forearm_${side}`].getWorldPosition(_v);
  return wrist.add(elbow.subVectors(wrist, elbow).normalize().multiplyScalar(PALM));
};

/** Walk-cycle offsets at `phase` (radians, one cycle = two steps), scaled by `amount` (0..1). */
export const walkCycle = (phase, amount) => {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const w = amount;
  return {
    thigh_L: { swing: 0.48 * s * w },
    thigh_R: { swing: -0.48 * s * w },
    // Knees bend while each leg swings through
    shin_L: { swing: -0.75 * Math.max(0, c) * w },
    shin_R: { swing: -0.75 * Math.max(0, -c) * w },
    foot_L: { swing: 0.2 * Math.max(0, c) * w },
    foot_R: { swing: 0.2 * Math.max(0, -c) * w },
    // Arms swing against the legs, elbows bending a little more on the way forward
    arm_L: { dir: [-0.38 * s * w, 0, 0], flex: (0.1 + 0.2 * Math.max(0, -s)) * w },
    arm_R: { dir: [0.38 * s * w, 0, 0], flex: (0.1 + 0.2 * Math.max(0, s)) * w },
    spine: { turn: -0.05 * s * w },
    chest: { turn: 0.08 * s * w },
  };
};

/** Breaststroke at `phase`: arms sweep out and back, then fold in and reach forward; legs kick. */
export const swimStroke = (phase) => {
  const s = Math.sin(phase);
  const pull = Math.max(0, s);
  const arm = { dir: [-0.5 * pull, -0.1 * pull, 0.9 * pull], flex: 0.5 * Math.max(0, -s) + 0.2 * pull };
  return { arm_L: arm, arm_R: arm, thigh_L: { swing: 0.3 * s }, thigh_R: { swing: -0.3 * s } };
};

/** Paddle stroke at `phase`: the torso twists, one hand rises as the other dips its blade. */
export const paddleStroke = (phase) => {
  const s = Math.sin(phase);
  return {
    chest: { turn: 0.3 * s },
    arm_L: { dir: [0.15 * s, 0.3 * s, 0], flex: -0.15 * s },
    arm_R: { dir: [-0.15 * s, -0.3 * s, 0], flex: 0.15 * s },
  };
};

/** Waving: the raised forearm sways side to side, within the elbow's bend. */
export const waveMotion = (t) => ({ arm_L: { flex: 0.28 * Math.sin(t * 8) } });

/** Cheering: fists pumping. */
export const cheerMotion = (t) => {
  const pump = 0.4 * (0.5 + 0.5 * Math.sin(t * 12));
  return { arm_L: { flex: pump }, arm_R: { flex: pump } };
};

/** Body bob (m) over the walk cycle: highest as the legs pass each other. */
export const walkBob = (phase, amount) => (Math.abs(Math.cos(phase)) - 0.6) * 0.03 * amount;

/** Add offset maps together (for stacking small motions on the walk cycle). */
export const addAngles = (...maps) => {
  const out = {};
  maps.forEach((m) =>
    Object.entries(m || {}).forEach(([n, a]) => {
      const o = (out[n] = out[n] || {});
      Object.entries(a).forEach(([key, v]) => {
        o[key] = Array.isArray(v) ? (o[key] || [0, 0, 0]).map((x, i) => x + (v[i] || 0)) : (o[key] || 0) + v;
      });
    })
  );
  return out;
};
