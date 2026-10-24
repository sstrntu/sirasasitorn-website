import React, { useMemo } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { ASSETS, LAYOUT } from './sceneConfig';

/*
 * Stylized camp set dressing: a log bench, a stump with an axe, a woodpile
 * and a few boulders. Simple low-poly shapes with flat colors; each has a
 * physics collider so tossed props bounce off them.
 */
const [FIRE_X, , FIRE_Z] = LAYOUT.campfire.position;

const PROPS = {
  // Fallen log used as a bench on the far side of the fire, away from the tent
  logSeat: { position: [FIRE_X - 0.8, 0, FIRE_Z + 0.8], rotationY: -0.785, length: 1.8, radius: 0.16 },
  // Stump with an axe planted in it, right of the table
  stump: { position: [1.75, 0, -1.25], rotationY: 0.4, height: 0.38, radius: 0.28 },
  boulders: [
    { position: [2.9, 0, -2.4], rotationY: 0.6, radius: 0.9, seed: 21 },
    { position: [-3.5, 0, 1.7], rotationY: 2.2, radius: 0.7, seed: 22 },
    { position: [3.4, 0, 1.2], rotationY: 4.1, radius: 0.45, seed: 23 },
  ],
};

const flat = { roughness: 0.9 };

/** A cylinder log with lighter cut ends. */
const Log = ({ length, radius }) => (
  <group rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius * 1.05, length, 9]} />
      <meshStandardMaterial color="#5e4a3a" {...flat} />
    </mesh>
    {[1, -1].map((side) => (
      <mesh key={side} position={[0, (side * length) / 2 + side * 0.001, 0]} rotation={[(side * -Math.PI) / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.98, 9]} />
        <meshStandardMaterial color="#b89c74" {...flat} />
      </mesh>
    ))}
  </group>
);

const LogSeat = () => {
  const { position, rotationY, length, radius } = PROPS.logSeat;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={[length / 2, radius, radius]} position={[0, radius, 0]} />
      <group position={[0, radius * 0.9, 0]}>
        <Log length={length} radius={radius} />
      </group>
    </RigidBody>
  );
};

const FIREWOOD = { radius: 0.04, length: 0.42 };
// Three crossed layers of split logs: [layer, offset across the layer]
const STACK = [
  [0, -0.13], [0, -0.045], [0, 0.045], [0, 0.13],
  [1, -0.12], [1, 0], [1, 0.12],
  [2, -0.05], [2, 0.05],
];

/** Firewood stacked in crossed layers beside the stump; Sira fetches armfuls from it. */
const Woodpile = () => {
  const { position, rotationY } = LAYOUT.woodpile;
  const { radius, length } = FIREWOOD;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={[length / 2, radius * 3, length / 2]} position={[0, radius * 3, 0]} />
      {STACK.map(([layer, offset], i) => {
        const along = layer % 2 === 0;
        // A little untidy: each log slightly turned and pulled out
        const wobble = ((i * 37) % 7) / 7 - 0.5;
        return (
          <group
            key={i}
            position={along ? [wobble * 0.03, radius * (1 + layer * 1.9), offset] : [offset, radius * (1 + layer * 1.9), wobble * 0.03]}
            rotation={[0, (along ? 0 : Math.PI / 2) + wobble * 0.12, Math.PI / 2]}
          >
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[radius, radius * 1.08, length, 7]} />
              <meshStandardMaterial color="#6e5038" {...flat} flatShading />
            </mesh>
            {[1, -1].map((side) => (
              <mesh key={side} position={[0, (side * length) / 2 + side * 0.001, 0]} rotation={[(side * -Math.PI) / 2, 0, 0]}>
                <circleGeometry args={[radius * 0.98, 7]} />
                <meshStandardMaterial color="#c49a66" {...flat} />
              </mesh>
            ))}
          </group>
        );
      })}
    </RigidBody>
  );
};

const StumpWithAxe = () => {
  const { position, rotationY, height, radius } = PROPS.stump;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CylinderCollider args={[height / 2, radius]} position={[0, height / 2, 0]} />
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.2, height, 9]} />
        <meshStandardMaterial color="#5e4a3a" {...flat} />
      </mesh>
      <mesh position={[0, height + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.98, 9]} />
        <meshStandardMaterial color="#b89c74" {...flat} />
      </mesh>
      {/* Axe: blade bitten into the stump, handle angled up */}
      <group position={[0.04, height + 0.02, 0]} rotation={[0, 0, -0.45]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.5, 6]} />
          <meshStandardMaterial color="#9a7a56" {...flat} />
        </mesh>
        <mesh position={[0.03, 0.0, 0]} castShadow>
          <boxGeometry args={[0.1, 0.07, 0.015]} />
          <meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
    </RigidBody>
  );
};

/** Boulders around the camp: the scanned limestone model, squashed and partly buried. */
const Boulders = () => {
  const { scene } = useGLTF(ASSETS.rocks.boulder, ASSETS.draco);
  const rock = useMemo(() => {
    let mesh = null;
    scene.traverse((o) => {
      if (!mesh && o.isMesh) mesh = o;
    });
    if (!mesh.userData.footprint) {
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
      mesh.userData.footprint = Math.max(size.x, size.z);
    }
    return mesh;
  }, [scene]);
  return PROPS.boulders.map((b, i) => {
    const horizontal = (b.radius * 2) / rock.userData.footprint;
    return (
      <RigidBody key={i} type="fixed" colliders={false} position={b.position} rotation={[0, b.rotationY, 0]}>
        <BallCollider args={[b.radius * 0.75]} position={[0, b.radius * 0.25, 0]} />
        <mesh
          geometry={rock.geometry}
          material={rock.material}
          position={[0, -b.radius * 0.3, 0]}
          rotation={[i % 2 ? Math.PI : 0, 0, 0]}
          scale={[horizontal, b.radius * 1.3, horizontal * 0.9]}
          castShadow
          receiveShadow
        />
      </RigidBody>
    );
  });
};

const CampProps = () => (
  <group>
    <LogSeat />
    <StumpWithAxe />
    <Woodpile />
    <Boulders />
  </group>
);

export default React.memo(CampProps);
