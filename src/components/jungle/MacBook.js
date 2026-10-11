import React, { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox, useTexture } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ASSETS, LAPTOP } from './sceneConfig';

const { width: W, depth: D, baseThickness: BASE_T, lidThickness: LID_T } = LAPTOP;
const CLOSED_ANGLE = Math.PI / 2 - 0.012;
const OPEN_ANGLE = -LAPTOP.openTilt;
// Camera distance (m) at which the "Click to open" label fades in / out
const HINT_SHOW_DISTANCE = 3.2;
const HINT_HIDE_DISTANCE = 3.6;

const SCREEN_W = W - 0.018;
const SCREEN_H = D - 0.03;
const SCREEN_Y = D / 2 + 0.006; // display sits a little above lid center (chin at the bottom)

const KEYBOARD = { width: 0.272, depth: 0.106, keyHeight: 0.0011, gap: 0.0019 };
// Relative key widths per row, MacBook-style layout (top row is half-height)
const KEY_ROWS = [
  { keys: Array(14).fill(1), depth: 0.55 },
  { keys: [...Array(13).fill(1), 1.5], depth: 1 },
  { keys: [1.5, ...Array(13).fill(1)], depth: 1 },
  { keys: [1.8, ...Array(11).fill(1), 1.8], depth: 1 },
  { keys: [2.35, ...Array(10).fill(1), 2.35], depth: 1 },
  { keys: [1, 1, 1, 1.3, 5.3, 1.3, 1, 1, 1, 1], depth: 1 },
];

const spaceGray = { color: '#7f8389', metalness: 1, roughness: 0.36 };

const Keyboard = () => {
  const meshRef = useRef();
  const keyCount = KEY_ROWS.reduce((n, row) => n + row.keys.length, 0);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const totalDepthUnits = KEY_ROWS.reduce((n, row) => n + row.depth, 0);
    const unitDepth = (KEYBOARD.depth - KEYBOARD.gap * KEY_ROWS.length) / totalDepthUnits;
    let z = -KEYBOARD.depth / 2;
    let index = 0;
    KEY_ROWS.forEach((row) => {
      const rowDepth = row.depth * unitDepth;
      const units = row.keys.reduce((a, b) => a + b, 0);
      const unitWidth = (KEYBOARD.width - KEYBOARD.gap * row.keys.length) / units;
      let x = -KEYBOARD.width / 2;
      row.keys.forEach((k) => {
        const keyWidth = k * unitWidth;
        matrix.makeScale(keyWidth, KEYBOARD.keyHeight, rowDepth);
        matrix.setPosition(x + keyWidth / 2 + KEYBOARD.gap / 2, KEYBOARD.keyHeight / 2, z + rowDepth / 2 + KEYBOARD.gap / 2);
        meshRef.current.setMatrixAt(index++, matrix);
        x += keyWidth + KEYBOARD.gap;
      });
      z += rowDepth + KEYBOARD.gap;
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group position={[0, BASE_T, -D / 2 + 0.018 + KEYBOARD.depth / 2]}>
      {/* Recessed keyboard well */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]}>
        <planeGeometry args={[KEYBOARD.width + 0.006, KEYBOARD.depth + 0.006]} />
        <meshStandardMaterial color="#2a2c2f" roughness={0.7} metalness={0.4} />
      </mesh>
      <instancedMesh ref={meshRef} args={[null, null, keyCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#121314" roughness={0.55} />
      </instancedMesh>
    </group>
  );
};

/**
 * MacBook-style laptop. Once `open` becomes true the lid waits `openDelay`
 * seconds, then swings open over `openDuration` seconds (eased), and the screen
 * shows the desktop wallpaper, so zooming into it lands seamlessly on /pro.
 *
 * Exposes `getScreenInfo()` (world center, normal, size) for the camera rig.
 */
const MacBook = forwardRef(({ open, openDelay = 0, openDuration = 1.2, interactive, showHint, onSelect }, ref) => {
  const lidRef = useRef();
  // Seconds since `open` became true (negative while waiting out the delay)
  const openClock = useRef(-openDelay);
  const screenRef = useRef();
  const screenMaterialRef = useRef();
  const [hovered, setHovered] = useState(false);
  // The "Click to open" label only appears once the camera is close to the laptop
  const [near, setNear] = useState(false);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const screenTexture = useTexture(ASSETS.screen);

  useLayoutEffect(() => {
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    // "cover" fit the wallpaper onto the display
    const imageAspect = screenTexture.image.width / screenTexture.image.height;
    const screenAspect = SCREEN_W / SCREEN_H;
    if (imageAspect > screenAspect) {
      screenTexture.repeat.set(screenAspect / imageAspect, 1);
    } else {
      screenTexture.repeat.set(1, imageAspect / screenAspect);
    }
    screenTexture.offset.set((1 - screenTexture.repeat.x) / 2, (1 - screenTexture.repeat.y) / 2);
    screenTexture.anisotropy = 8;
    screenTexture.needsUpdate = true;
  }, [screenTexture]);

  useImperativeHandle(ref, () => ({
    getScreenInfo: () => {
      const screen = screenRef.current;
      screen.updateWorldMatrix(true, false);
      const center = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      screen.getWorldPosition(center);
      screen.getWorldQuaternion(quaternion);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      return { center, normal, up, width: SCREEN_W, height: SCREEN_H };
    },
  }));

  useFrame(({ camera }, delta) => {
    const lid = lidRef.current;
    // Hysteresis so the label doesn't flicker at the threshold
    lid.getWorldPosition(worldPos);
    const distance = camera.position.distanceTo(worldPos);
    if (!near && distance < HINT_SHOW_DISTANCE) setNear(true);
    else if (near && distance > HINT_HIDE_DISTANCE) setNear(false);
    openClock.current = open ? openClock.current + Math.min(delta, 1 / 20) : -openDelay;
    const t = THREE.MathUtils.clamp(openClock.current / openDuration, 0, 1);
    // Ease in-out, with a slight overshoot-free settle at the end
    const openness = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    lid.rotation.x = THREE.MathUtils.lerp(CLOSED_ANGLE, OPEN_ANGLE, openness);
    // Screen powers on as the lid opens and brightens on hover
    const target = (hovered && interactive ? 1.35 : 1.08) * THREE.MathUtils.smoothstep(openness, 0.55, 1);
    const color = screenMaterialRef.current.color;
    const next = THREE.MathUtils.damp(color.r, target, 6, delta);
    color.setScalar(next);
  });

  const handlePointerOver = (e) => {
    if (!interactive) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = '';
  };
  const handleClick = (e) => {
    // Ignore clicks that were really camera drags
    if (!interactive || e.delta > 6) return;
    e.stopPropagation();
    document.body.style.cursor = '';
    onSelect?.();
  };

  return (
    <group
      position={LAPTOP.offset}
      rotation={[0, LAPTOP.rotationY, 0]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, BASE_T / 2, D / 2]} position={[0, BASE_T / 2, 0]} />
      </RigidBody>

      {/* Base */}
      <RoundedBox args={[W, BASE_T, D]} radius={0.004} smoothness={3} position={[0, BASE_T / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...spaceGray} />
      </RoundedBox>
      <Keyboard />
      {/* Trackpad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BASE_T + 0.0003, D / 2 - 0.05]}>
        <planeGeometry args={[0.13, 0.078]} />
        <meshStandardMaterial color="#8a8e94" metalness={0.85} roughness={0.22} />
      </mesh>
      {/* Hinge */}
      <mesh position={[0, BASE_T + 0.001, -D / 2 + 0.006]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0045, 0.0045, W * 0.82, 16]} />
        <meshStandardMaterial color="#3b3d40" metalness={0.9} roughness={0.4} />
      </mesh>

      {/* Lid pivots about the hinge; starts closed */}
      <group ref={lidRef} position={[0, BASE_T + 0.001, -D / 2 + 0.006]} rotation={[CLOSED_ANGLE, 0, 0]}>
        <RoundedBox args={[W, D, LID_T]} radius={0.003} smoothness={3} position={[0, D / 2, -LID_T / 2]} castShadow>
          <meshStandardMaterial {...spaceGray} />
        </RoundedBox>
        {/* Black glass bezel */}
        <mesh position={[0, D / 2, 0.0003]}>
          <planeGeometry args={[W - 0.004, D - 0.004]} />
          <meshStandardMaterial color="#050506" roughness={0.08} metalness={0.2} />
        </mesh>
        {/* Display */}
        <mesh ref={screenRef} position={[0, SCREEN_Y, 0.0006]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial ref={screenMaterialRef} map={screenTexture} toneMapped={false} color="#000000" />
        </mesh>
        {/* Soft glow the screen throws onto the table and keyboard */}
        <pointLight position={[0, SCREEN_Y, 0.12]} color="#a9bcff" intensity={open ? 0.35 : 0} distance={1.6} decay={2} />

        {showHint && interactive && (
          <Html position={[0, D + 0.07, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`jungle-laptop-hint ${near ? 'is-visible' : ''} ${hovered ? 'is-hovered' : ''}`}>{window.matchMedia('(pointer: coarse)').matches ? 'Tap to open' : 'Click to open'}</div>
          </Html>
        )}
      </group>
    </group>
  );
});

MacBook.displayName = 'MacBook';

export default MacBook;
