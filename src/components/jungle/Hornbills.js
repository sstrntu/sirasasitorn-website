import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LAPTOP_FOCUS } from './sceneConfig';
import { discover } from './utils/play';
import { weatherNow } from './utils/krabiWeather';
import { day } from './utils/siraDay';
import { NOT_OCCLUDER } from './utils/groundOcclusion';

/*
 * A pair of oriental pied hornbills flying over the camp: black with a white
 * belly, white-edged wings and tail tips, and a big pale bill with a casque.
 * They come by most often in the early morning (as hornbills do), now and
 * then later in the day, never at night or in the rain. Each flight is laid
 * out across the visitor's current view so it's seen: in from far away above
 * the jungle, low over the camp with heavy flaps and glides, and away.
 * Tapping one startles them both up and away.
 */
const SPEED = 5.5; // m/s
const FLAP_HZ = 2.6;
const FLAP_SECONDS = 1.8;
const GLIDE_SECONDS = 1.3;
const DAWN = [6, 9.5];
const DAYLIGHT = [6, 18.3];

/** A wing panel outline from [x, z] points (x out along the wing, z forward), flat in the XZ plane. */
const panel = (points) => {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
};

const buildGeometries = () => ({
  sphere: new THREE.SphereGeometry(1, 14, 10),
  bill: new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0).rotateX(Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1),
  // Inner wing (arm) and outer wing (hand), black, each with a white trailing edge
  inner: panel([[0, 0.07], [0.22, 0.055], [0.22, -0.085], [0, -0.095]]),
  innerEdge: panel([[0, -0.095], [0.22, -0.085], [0.22, -0.115], [0, -0.125]]),
  outer: panel([[0, 0.055], [0.15, 0.04], [0.25, 0.005], [0.27, -0.02], [0.2, -0.06], [0, -0.085]]),
  outerEdge: panel([[0, -0.085], [0.2, -0.06], [0.27, -0.02], [0.28, -0.045], [0.2, -0.09], [0, -0.115]]),
});

const BLACK = '#18181b';
const WHITE = '#efefe9';

/**
 * One hornbill. `wings` collects [shoulder, wrist] groups per side for
 * flapping: the shoulder turns about the body's long axis (signed per side),
 * the wrist inside the mirrored wing.
 */
const Bird = React.forwardRef(({ geometries, materials, wings, onTap }, ref) => {
  const { sphere, bill, box, inner, innerEdge, outer, outerEdge } = geometries;
  const { black, white, beak, dark } = materials;
  const wing = (side, index) => (
    <group key={side} position={[side * 0.055, 0.035, 0.03]} userData={{ side }} ref={(g) => (wings[index * 2] = g)}>
      <group scale={[side, 1, 1]}>
        <mesh geometry={inner} material={black} castShadow />
        <mesh geometry={innerEdge} material={white} />
        <group position={[0.22, 0, 0]} ref={(g) => (wings[index * 2 + 1] = g)}>
          <mesh geometry={outer} material={black} castShadow />
          <mesh geometry={outerEdge} material={white} />
        </group>
      </group>
    </group>
  );
  return (
    <group ref={ref} scale={0.0001}>
      <mesh geometry={sphere} material={black} scale={[0.085, 0.078, 0.2]} castShadow />
      <mesh geometry={sphere} material={white} position={[0, -0.032, -0.07]} scale={[0.068, 0.05, 0.12]} />
      <mesh geometry={sphere} material={black} position={[0, 0.035, 0.19]} scale={0.062} castShadow />
      {/* Bill and casque */}
      <mesh geometry={bill} material={beak} position={[0, 0.02, 0.23]} rotation={[0.28, 0, 0]} scale={[0.027, 0.03, 0.21]} />
      <mesh geometry={sphere} material={beak} position={[0, 0.06, 0.28]} scale={[0.017, 0.024, 0.07]} />
      <mesh geometry={sphere} material={dark} position={[0, 0.066, 0.335]} scale={[0.0125, 0.017, 0.02]} />
      {/* Bare white skin around the eyes */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh geometry={sphere} material={white} position={[side * 0.048, 0.048, 0.215]} scale={0.013} />
          <mesh geometry={sphere} material={dark} position={[side * 0.055, 0.048, 0.22]} scale={0.0065} />
        </group>
      ))}
      {/* Long tail, tipped white */}
      <mesh geometry={box} material={black} position={[0, 0.0, -0.31]} scale={[0.085, 0.012, 0.26]} castShadow />
      <mesh geometry={box} material={white} position={[0, 0.0, -0.455]} scale={[0.085, 0.013, 0.04]} />
      {wing(1, 0)}
      {wing(-1, 1)}
      {/* Generous, invisible hit area: it's a small, fast target */}
      <mesh geometry={sphere} scale={0.7} onClick={onTap}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
});

/** Flight path through `center`, crossing the view from one side to the other. */
const buildFlight = (camera) => {
  // A point in the upper middle of the view, a little beyond the camp
  const target = new THREE.Vector3(...LAPTOP_FOCUS);
  const flat = new THREE.Vector3(camera.position.x - target.x, 0, camera.position.z - target.z);
  const reach = flat.length() + 2.5;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(THREE.MathUtils.randFloat(-0.15, 0.15), 0.3), camera);
  const horizontal = Math.hypot(ray.ray.direction.x, ray.ray.direction.z) || 1;
  const center = ray.ray.at(reach / horizontal, new THREE.Vector3());
  center.y = THREE.MathUtils.clamp(center.y, 2.8, 9);
  // Across the view, either way
  const across = new THREE.Vector3(-flat.z, 0, flat.x).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
  across.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.randFloat(-0.35, 0.35));
  const point = (along, up) => center.clone().addScaledVector(across, along).add(new THREE.Vector3(0, up, 0));
  const swerve = new THREE.Vector3(-across.z, 0, across.x).multiplyScalar(THREE.MathUtils.randFloat(-1.5, 1.5));
  return new THREE.CatmullRomCurve3([point(-48, 12), point(-18, 4.5), point(0, 0).add(swerve), point(18, 4.5), point(48, 13)]);
};

/** The pair: the second bird follows a little behind and to one side. */
const FOLLOW = { lag: 1.4, side: 1.1, up: 0.35 };

const Hornbills = () => {
  const geometries = useMemo(buildGeometries, []);
  const materials = useMemo(
    () => ({
      black: new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.7, side: THREE.DoubleSide }),
      white: new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.8, side: THREE.DoubleSide }),
      beak: new THREE.MeshStandardMaterial({ color: '#e8d69a', roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1f1a12', roughness: 0.5 }),
    }),
    []
  );
  const birds = [useRef(), useRef()];
  const wings = useMemo(() => [[], []], []);
  const flight = useRef({ curve: null, length: 1, distance: 0, next: null, startled: 0, lastYaw: [0, 0] });
  const temp = useMemo(
    () => ({ p: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3(), look: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), roll: new THREE.Quaternion() }),
    []
  );

  const startle = (e) => {
    e.stopPropagation();
    const f = flight.current;
    if (!f.curve || f.startled) return;
    f.startled = performance.now() / 1000;
    discover('hornbill');
  };

  useFrame(({ camera, clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const f = flight.current;
    const hour = day.hour;
    const dawn = hour >= DAWN[0] && hour < DAWN[1];
    const daylight = hour >= DAYLIGHT[0] && hour < DAYLIGHT[1];

    if (!f.curve) {
      // Not drawn between flights (they're drawn once at load, tiny, so their shaders compile with the rest)
      birds.forEach((b) => b.current && (b.current.visible = false));
      if (f.next === null) f.next = t + (dawn ? THREE.MathUtils.randFloat(6, 10) : THREE.MathUtils.randFloat(20, 35));
      if (t < f.next) return;
      if (!daylight || weatherNow.rain > 0.3) {
        f.next = t + 30;
        return;
      }
      f.curve = buildFlight(camera);
      f.length = f.curve.getLength();
      f.distance = 0;
      f.startled = 0;
      birds.forEach((b) => b.current && (b.current.visible = true));
    }

    const startledFor = f.startled ? performance.now() / 1000 - f.startled : 0;
    f.distance += SPEED * (f.startled ? 1.6 : 1) * dt;
    const climb = f.startled ? Math.min(startledFor, 4) * 2.2 : 0;
    let done = true;
    birds.forEach((bird, i) => {
      const group = bird.current;
      if (!group) return;
      const along = f.distance - i * FOLLOW.lag;
      const u = THREE.MathUtils.clamp(along / f.length, 0, 1);
      if (along / f.length < 1) done = false;
      const { p, tangent, side, look, m, q, roll } = temp;
      f.curve.getPointAt(u, p);
      f.curve.getTangentAt(u, tangent);
      side.set(-tangent.z, 0, tangent.x).normalize();
      p.addScaledVector(side, i * FOLLOW.side).add(look.set(0, i * FOLLOW.up + climb, 0));
      // Fly nose-first along the path, banking into turns
      const yaw = Math.atan2(tangent.x, tangent.z);
      const turn = THREE.MathUtils.clamp(((yaw - f.lastYaw[i] + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -0.2, 0.2);
      f.lastYaw[i] = yaw;
      const bank = THREE.MathUtils.clamp((-turn / Math.max(dt, 1e-3)) * 0.35, -0.55, 0.55);
      look.copy(p).add(tangent);
      m.lookAt(look, p, THREE.Object3D.DEFAULT_UP);
      q.setFromRotationMatrix(m);
      group.quaternion.copy(q).multiply(roll.setFromAxisAngle(look.set(0, 0, 1), bank));
      group.position.copy(p);
      // Grow in out of the distance and shrink away at the far ends
      group.scale.setScalar(THREE.MathUtils.smoothstep(u, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(u, 0.94, 1)) || 0.0001);
      // Heavy flaps, then a glide with the wings held up a little
      const cycle = (t + i * 0.37) % (FLAP_SECONDS + GLIDE_SECONDS);
      const flapping = f.startled || cycle < FLAP_SECONDS;
      const phase = (t + i * 0.21) * FLAP_HZ * Math.PI * 2 * (f.startled ? 1.25 : 1);
      const shoulder = flapping ? 0.12 + 0.55 * Math.sin(phase) : 0.1;
      const wrist = flapping ? 0.3 * Math.sin(phase - 0.7) : 0.03;
      wings[i].forEach((g, k) => {
        if (!g) return;
        g.rotation.z = k % 2 === 0 ? shoulder * g.userData.side : wrist;
      });
    });
    if (done) {
      f.curve = null;
      birds.forEach((b) => b.current && (b.current.visible = false));
      f.next = t + (dawn ? THREE.MathUtils.randFloat(70, 110) : THREE.MathUtils.randFloat(150, 260));
    }
  });

  return (
    <group userData={NOT_OCCLUDER}>
      {birds.map((ref, i) => (
        <Bird key={i} ref={ref} geometries={geometries} materials={materials} wings={wings[i]} onTap={startle} />
      ))}
    </group>
  );
};

export default React.memo(Hornbills);
