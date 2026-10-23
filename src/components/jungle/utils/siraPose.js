/*
 * Procedural posing for Sira's skeleton. Every joint is turned about the
 * character's own body axes, never by "shortest arc" aiming, so heads and
 * limbs can't roll or twist sideways:
 *   swing - about the body's right axis: limbs hanging down swing forward
 *           (positive), the torso and head tip back (positive) / forward (negative)
 *   out   - about the body's forward axis: limbs move out to the side (positive)
 *   turn  - about the body's up axis: toward the character's left (positive)
 * Angles are applied swing -> out -> turn, parents before children.
 *
 * Pose keys without a side (`upperarm`) apply to both sides, mirrored; keys
 * with a side (`upperarm_R`) are used as given.
 */
import * as THREE from 'three';

const ORDER = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L',
  'shoulder_R', 'upperarm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L',
  'thigh_R', 'shin_R', 'foot_R',
];
const LIMB = /^(shoulder|upperarm|forearm|hand|thigh|shin|foot)$/;

/** Static poses (radians). */
export const POSES = {
  stand: { upperarm: { out: 0.04 }, forearm: { swing: 0.12 } },
  // Squatting by the fire, the right hand poking at it
  crouch: {
    thigh: { swing: 1.0, out: 0.12 },
    shin: { swing: -1.75 },
    foot: { swing: 0.55 },
    spine: { swing: -0.3 },
    chest: { swing: -0.15 },
    // The forward lean swings the arms back with the torso, so they reach further forward
    upperarm_L: { swing: 0.8, out: 0.15 },
    forearm_L: { swing: 0.9 },
    upperarm_R: { swing: 1.4 },
    forearm_R: { swing: 0.3 },
  },
  // Squatting at the laptop, both hands forward on the keys
  type: {
    thigh: { swing: 1.0, out: 0.15 },
    shin: { swing: -1.75 },
    foot: { swing: 0.55 },
    spine: { swing: -0.25 },
    chest: { swing: -0.1 },
    upperarm: { swing: 1.35, out: -0.02 },
    forearm: { swing: 0.5 },
  },
  // On the log, hands resting on the knees
  sit: {
    thigh: { swing: 1.45, out: 0.08 },
    shin: { swing: -1.4 },
    spine: { swing: -0.04 },
    upperarm: { swing: 0.45, out: 0.04 },
    forearm: { swing: 0.55 },
  },
  stretch: {
    upperarm: { out: 2.75, swing: 0.15 },
    forearm: { out: 0.25 },
    spine: { swing: 0.12 },
    head: { swing: 0.25 },
  },
  // Pushing a palm trunk to shake its coconuts loose
  shake: { upperarm: { swing: 1.35, out: -0.05 }, forearm: { swing: 0.35 }, spine: { swing: -0.1 } },
  // In the kayak: legs out straight, arms forward on the paddle
  kayak: {
    thigh: { swing: 1.45, out: 0.1 },
    shin: { swing: -0.1 },
    spine: { swing: -0.05 },
    upperarm: { swing: 1.15, out: 0.12 },
    forearm: { swing: 0.55 },
  },
  // Swimming breaststroke, leaning into the water (the stroke itself is in swimStroke)
  swim: { spine: { swing: -0.45 }, head: { swing: 0.4 }, upperarm: { swing: 1.3 }, forearm: { swing: 0.3 } },
  wave: { upperarm_L: { out: 2.45, swing: 0.15 } },
  cheer: { upperarm: { out: 2.55, swing: 0.1 }, forearm: { out: 0.3 } },
  flinch: { upperarm: { swing: 1.45, out: -0.18 }, forearm: { swing: 1.4 }, spine: { swing: 0.2 } },
  cold: { upperarm: { swing: 0.45, out: -0.3 }, forearm: { swing: 1.95 }, chest: { swing: -0.12 } },
};

/** Bones a reaction leaves to the base pose when he's sitting or squatting. */
export const LOWER_BODY = ['hips', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];

const expand = (pose) => {
  const out = {};
  Object.entries(pose || {}).forEach(([key, a]) => {
    if (out[key] === undefined && !LIMB.test(key)) out[key] = { ...a };
    if (LIMB.test(key)) {
      out[`${key}_L`] = { ...out[`${key}_L`], ...a };
      out[`${key}_R`] = { ...out[`${key}_R`], ...a, out: -(a.out || 0), turn: -(a.turn || 0) };
    } else if (/_[LR]$/.test(key)) out[key] = { ...out[key], ...a };
  });
  return out;
};

/** Merge pose layers: later layers replace earlier ones bone by bone. */
export const combine = (...layers) => Object.assign({}, ...layers.map(expand));

const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _axis = new THREE.Vector3();

const rotate = (bone, axis, angle) => {
  if (Math.abs(angle) < 1e-5) return;
  _q.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_qw).premultiply(_q);
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw));
  bone.updateMatrixWorld(true);
};

/**
 * Drives the bones of a cloned rig. `model` is the (scaled) model root, `bones`
 * maps bone names to bones; `height` is the real height the model is scaled to.
 */
export const createPoser = (model, bones, height) => {
  const rest = new Map(ORDER.map((n) => [n, bones[n].quaternion.clone()]));
  const current = Object.fromEntries(ORDER.map((n) => [n, { swing: 0, out: 0, turn: 0 }]));
  // Leg lengths (m) from the rest skeleton, for keeping the feet planted
  model.updateMatrixWorld(true);
  const p = (n) => bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(model.matrixWorld.clone().invert());
  const thighLen = p('thigh_L').distanceTo(p('shin_L')) * height;
  const shinLen = p('shin_L').distanceTo(p('foot_L')) * height;
  const axes = { right: new THREE.Vector3(), up: new THREE.Vector3(), forward: new THREE.Vector3() };

  /** Hip drop and how far the hips sit behind the ankle for thigh swing `a` and knee swing `b`. */
  const legOffset = (a, b) => {
    const x = thighLen * Math.sin(a) + shinLen * Math.sin(a + b);
    const y = thighLen * Math.cos(a) + shinLen * Math.cos(a + b);
    return { drop: thighLen + shinLen - y, back: x };
  };

  /**
   * Blend toward `target` (a combined pose) at `rate`, add the `extra` angles on
   * top (walk cycle, head look, small motions), and pose the skeleton.
   * Returns the hip drop and back-shift for the blended legs.
   */
  const update = (target, extra, rate, dt) => {
    ORDER.forEach((n) => {
      const c = current[n];
      const t = target[n] || {};
      const k = 1 - Math.exp(-(t.rate || rate) * dt);
      c.swing += ((t.swing || 0) - c.swing) * k;
      c.out += ((t.out || 0) - c.out) * k;
      c.turn += ((t.turn || 0) - c.turn) * k;
    });
    ORDER.forEach((n) => bones[n].quaternion.copy(rest.get(n)));
    model.updateMatrixWorld(true);
    const q = model.getWorldQuaternion(_qw.clone());
    axes.right.set(0, 0, 1).applyQuaternion(q);
    axes.up.set(0, 1, 0).applyQuaternion(q);
    axes.forward.set(1, 0, 0).applyQuaternion(q);
    ORDER.forEach((n) => {
      const c = current[n];
      const e = extra[n] || {};
      const bone = bones[n];
      rotate(bone, _axis.copy(axes.right), c.swing + (e.swing || 0));
      rotate(bone, _axis.copy(axes.forward), c.out + (e.out || 0));
      rotate(bone, _axis.copy(axes.up), c.turn + (e.turn || 0));
    });
    // The supporting (straighter) leg sets the height
    const l = legOffset(current.thigh_L.swing, current.shin_L.swing);
    const r = legOffset(current.thigh_R.swing, current.shin_R.swing);
    return l.drop < r.drop ? l : r;
  };

  // Hip joint height (m) when standing
  const hipHeight = p('thigh_L').y * height;
  return { update, legOffset, hipHeight };
};

/** Walk-cycle angles at `phase` (radians, one cycle = two steps), scaled by `amount` (0..1). */
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
    upperarm_L: { swing: -0.32 * s * w },
    upperarm_R: { swing: 0.32 * s * w },
    forearm_L: { swing: 0.2 * w },
    forearm_R: { swing: 0.2 * w },
    spine: { turn: -0.05 * s * w },
    chest: { turn: 0.08 * s * w },
  };
};

/** Breaststroke at `phase`: arms sweep out and back, legs kick. */
export const swimStroke = (phase) => {
  const s = Math.sin(phase);
  const pull = Math.max(0, s);
  return {
    upperarm_L: { out: 0.25 + 0.8 * pull, swing: -0.4 * pull },
    upperarm_R: { out: -(0.25 + 0.8 * pull), swing: -0.4 * pull },
    forearm_L: { swing: 0.6 * Math.max(0, -s) },
    forearm_R: { swing: 0.6 * Math.max(0, -s) },
    thigh_L: { swing: 0.3 * s },
    thigh_R: { swing: -0.3 * s },
  };
};

/** Paddle stroke at `phase`: the torso twists and the arms push and pull the paddle. */
export const paddleStroke = (phase) => {
  const s = Math.sin(phase);
  return {
    chest: { turn: 0.32 * s },
    upperarm_L: { swing: 0.25 * s },
    upperarm_R: { swing: -0.25 * s },
  };
};

/** Body bob (m) over the walk cycle: highest as the legs pass each other. */
export const walkBob = (phase, amount) => (Math.abs(Math.cos(phase)) - 0.6) * 0.03 * amount;

/** Add angle maps together (for stacking small motions on the walk cycle). */
export const addAngles = (...maps) => {
  const out = {};
  maps.forEach((m) =>
    Object.entries(m || {}).forEach(([n, a]) => {
      const o = (out[n] = out[n] || { swing: 0, out: 0, turn: 0 });
      o.swing += a.swing || 0;
      o.out += a.out || 0;
      o.turn += a.turn || 0;
    })
  );
  return out;
};
