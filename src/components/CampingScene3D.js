import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

const CampingModel = ({ onClick }) => {
  const gltf = useGLTF('/camping.glb');

  if (!gltf || !gltf.scene) {
    return (
      <group onClick={onClick}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#00ff44" />
        </mesh>
        <Text
          position={[0, -0.5, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          Loading camping scene...
        </Text>
      </group>
    );
  }

  return (
    <primitive
      object={gltf.scene}
      scale={[10, 10, 10]}
      position={[0, -0.3, 0]}
      onClick={onClick}
    />
  );
};

const CameraAnimation = ({ controlsRef }) => {
  const { camera } = useThree();
  const animationStartTimeRef = useRef(null);
  const animationCompleteRef = useRef(false);

  // Starting position (far away)
  const startPosition = new THREE.Vector3(12.15, 2.41, 8.46);
  // Target position (close zoom)
  const endPosition = new THREE.Vector3(1.36, 0.25, 1.20);

  useEffect(() => {
    // Set initial camera position only once
    if (!animationCompleteRef.current) {
      camera.position.copy(startPosition);
      camera.lookAt(0, 0, 0);

      // Disable controls during animation
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.set(0, 0, 0);
      }
    }
  }, [camera, startPosition, controlsRef]);

  useFrame((state, delta) => {
    if (!animationCompleteRef.current) {
      // Initialize start time on first frame
      if (animationStartTimeRef.current === null) {
        animationStartTimeRef.current = state.clock.elapsedTime;
      }

      // Calculate progress based on elapsed time since animation start
      const elapsed = state.clock.elapsedTime - animationStartTimeRef.current;
      const progress = Math.min(elapsed / 3, 1);

      if (progress < 1) {
        // Smooth easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        // Interpolate between start and end positions
        camera.position.lerpVectors(startPosition, endPosition, easedProgress);
        camera.lookAt(0, 0, 0);
      } else {
        // Animation complete - set final position and enable controls
        camera.position.copy(endPosition);
        camera.lookAt(0, 0, 0);
        animationCompleteRef.current = true;

        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          // Set distance constraints based on final position
          const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
          controlsRef.current.minDistance = distance * 0.3;
          controlsRef.current.maxDistance = distance * 3;
          controlsRef.current.enabled = true;
          controlsRef.current.update();
        }
      }
    }
  });

  return null;
};

const DebugInfo = ({ controlsRef }) => {
  const { camera } = useThree();

  useFrame(() => {
    const target = new THREE.Vector3(0, 0, 0);
    const distance = camera.position.distanceTo(target);

    console.log(`Camera Position: X: ${camera.position.x.toFixed(2)}, Y: ${camera.position.y.toFixed(2)}, Z: ${camera.position.z.toFixed(2)}, Distance: ${distance.toFixed(2)}`);
  });

  return null;
};

const LoadingScreen = () => (
  <Html center>
    <div style={{
      color: '#00ff00',
      fontSize: '18px',
      fontFamily: 'monospace',
      textAlign: 'center',
      background: 'rgba(0,0,0,0.8)',
      padding: '20px',
      borderRadius: '10px'
    }}>
      <div>Loading camping scene...</div>
      <div style={{ marginTop: '10px', fontSize: '14px' }}>
        Please wait, loading 46MB model...
      </div>
    </div>
  </Html>
);

const CampingScene3D = ({ onObjectClick }) => {
  const controlsRef = useRef();

  // Add global CSS reset for this component
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';

    return () => {
      // Cleanup not needed as this is the main view
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(to bottom, #1a1a2e, #16213e)',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      zIndex: 0
    }}>
      <Canvas
        camera={{ fov: 50 }}
        style={{
          background: 'transparent',
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          <CameraAnimation controlsRef={controlsRef} />
          <DebugInfo controlsRef={controlsRef} />

          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-5, 2, -2]} intensity={0.3} color="#4169e1" />
          <pointLight position={[5, 2, 2]} intensity={0.3} color="#ff6b35" />

          <CampingModel onClick={onObjectClick} />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={1}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CampingScene3D;