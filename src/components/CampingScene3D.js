import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

const CampingModel = ({ onClick, onMeshFound }) => {
  const gltf = useGLTF('/camping.glb');
  const mixer = useRef();
  const targetMeshRef = useRef();

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

  // Find target mesh by ID and get its world position
  useEffect(() => {
    if (gltf.scene) {
      const findMeshById = (object, targetId) => {
        if (object.name === targetId || object.uuid === targetId) {
          return object;
        }

        for (const child of object.children) {
          const found = findMeshById(child, targetId);
          if (found) return found;
        }
        return null;
      };

      // Look for the target mesh
      const targetMesh = findMeshById(gltf.scene, 'abgVijaHVNRUvcc');

      if (targetMesh) {
        targetMeshRef.current = targetMesh;
        console.log('Found target mesh:', targetMesh.name || targetMesh.uuid);

        // Calculate world position and bounding box
        const box = new THREE.Box3().setFromObject(targetMesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Apply the model's scale and position transforms
        center.multiplyScalar(10); // Apply scale
        center.add(new THREE.Vector3(0, -0.3, 0)); // Apply position offset

        console.log('Target mesh center:', center);
        console.log('Target mesh size:', size);

        if (onMeshFound) {
          onMeshFound(center, size);
        }
      } else {
        console.log('Target mesh not found. Available objects:');
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            console.log('- Mesh:', child.name || 'unnamed', 'UUID:', child.uuid);
          }
        });
      }
    }
  }, [gltf.scene, onMeshFound]);

  // Set up animations
  useEffect(() => {
    if (gltf.animations && gltf.animations.length > 0) {
      mixer.current = new THREE.AnimationMixer(gltf.scene);

      // Play all animations
      gltf.animations.forEach((clip) => {
        const action = mixer.current.clipAction(clip);
        action.play();
        console.log('Playing animation:', clip.name);
      });
    }
  }, [gltf.animations, gltf.scene]);

  // Update animation mixer
  useFrame((state, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);
    }
  });

  return (
    <primitive
      object={gltf.scene}
      scale={[10, 10, 10]}
      position={[0, -0.3, 0]}
      onClick={onClick}
    />
  );
};

const CameraAnimation = ({ controlsRef, targetMeshPosition, targetMeshSize, zoomToTarget }) => {
  const { camera } = useThree();
  const animationStartTimeRef = useRef(null);
  const animationCompleteRef = useRef(false);
  const targetZoomStartRef = useRef(null);
  const targetZoomCompleteRef = useRef(false);

  // Starting position (far away)
  const startPosition = new THREE.Vector3(12.15, 2.41, 8.46);
  // Default end position (close zoom)
  const defaultEndPosition = new THREE.Vector3(1.36, 0.25, 1.20);

  // Calculate optimal camera position for target mesh
  const getOptimalCameraPosition = (meshCenter, meshSize) => {
    if (!meshCenter || !meshSize) return defaultEndPosition;

    // Calculate distance based on mesh size
    const maxSize = Math.max(meshSize.x, meshSize.y, meshSize.z);
    const distance = maxSize * 2; // Adjust this multiplier as needed

    // Position camera at an angle to the mesh
    const offset = new THREE.Vector3(distance * 0.7, distance * 0.5, distance * 0.7);
    return meshCenter.clone().add(offset);
  };

  useEffect(() => {
    // Set initial camera position only once
    if (!animationCompleteRef.current && !targetZoomCompleteRef.current) {
      camera.position.copy(startPosition);
      camera.lookAt(0, 0, 0);

      // Disable controls during animation
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.set(0, 0, 0);
      }
    }
  }, [camera, startPosition, controlsRef]);

  useEffect(() => {
    // If we should zoom to target and we have the target info, start target zoom
    if (zoomToTarget && targetMeshPosition && !targetZoomCompleteRef.current) {
      animationCompleteRef.current = true; // Skip the initial animation
      targetZoomStartRef.current = null; // Reset target zoom timer
      console.log('Starting zoom to target mesh');
    }
  }, [zoomToTarget, targetMeshPosition]);

  useFrame((state, delta) => {
    // Initial animation (scene overview)
    if (!animationCompleteRef.current && !zoomToTarget) {
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
        camera.position.lerpVectors(startPosition, defaultEndPosition, easedProgress);
        camera.lookAt(0, 0, 0);
      } else {
        // Animation complete - set final position and enable controls
        camera.position.copy(defaultEndPosition);
        camera.lookAt(0, 0, 0);
        animationCompleteRef.current = true;

        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
          controlsRef.current.minDistance = distance * 0.3;
          controlsRef.current.maxDistance = distance * 3;
          controlsRef.current.enabled = true;
          controlsRef.current.update();
        }
      }
    }

    // Target mesh zoom animation
    if (zoomToTarget && targetMeshPosition && !targetZoomCompleteRef.current) {
      // Initialize target zoom start time
      if (targetZoomStartRef.current === null) {
        targetZoomStartRef.current = state.clock.elapsedTime;
        // Disable controls during target zoom
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      }

      const elapsed = state.clock.elapsedTime - targetZoomStartRef.current;
      const progress = Math.min(elapsed / 2, 1); // 2 second animation

      if (progress < 1) {
        const currentPos = camera.position.clone();
        const targetPos = getOptimalCameraPosition(targetMeshPosition, targetMeshSize);

        // Smooth easing function
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(currentPos, targetPos, easedProgress);

        // Look at the target mesh
        const lookAtTarget = targetMeshPosition.clone();
        const currentLookAt = new THREE.Vector3(0, 0, 0);
        const targetLookAt = lookAtTarget.lerp(currentLookAt, easedProgress);
        camera.lookAt(targetLookAt);
      } else {
        // Target zoom complete
        const finalPos = getOptimalCameraPosition(targetMeshPosition, targetMeshSize);
        camera.position.copy(finalPos);
        camera.lookAt(targetMeshPosition);
        targetZoomCompleteRef.current = true;

        if (controlsRef.current) {
          controlsRef.current.target.copy(targetMeshPosition);
          const distance = camera.position.distanceTo(targetMeshPosition);
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

const CampingScene3D = ({ onObjectClick, targetMeshId = 'abgVijaHVNRUvcc' }) => {
  const controlsRef = useRef();
  const [targetMeshPosition, setTargetMeshPosition] = useState(null);
  const [targetMeshSize, setTargetMeshSize] = useState(null);
  const [zoomToTarget, setZoomToTarget] = useState(false);

  // Function to handle when target mesh is found
  const handleMeshFound = (position, size) => {
    setTargetMeshPosition(position);
    setTargetMeshSize(size);
    console.log('Mesh found, position and size set');
  };

  // Function to trigger zoom to target mesh
  const triggerZoomToTarget = () => {
    if (targetMeshPosition) {
      setZoomToTarget(true);
      console.log('Triggering zoom to target mesh');
    } else {
      console.log('Target mesh position not available yet');
    }
  };

  // Expose function to parent components
  useEffect(() => {
    window.zoomToTargetMesh = triggerZoomToTarget;
    console.log('zoomToTargetMesh function exposed to window');

    return () => {
      delete window.zoomToTargetMesh;
    };
  }, [targetMeshPosition]);

  // Auto-trigger zoom after 5 seconds for demonstration
  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetMeshPosition && !zoomToTarget) {
        console.log('Auto-triggering zoom to target mesh after 5 seconds');
        triggerZoomToTarget();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [targetMeshPosition, zoomToTarget]);

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
          <CameraAnimation
            controlsRef={controlsRef}
            targetMeshPosition={targetMeshPosition}
            targetMeshSize={targetMeshSize}
            zoomToTarget={zoomToTarget}
          />
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

          <CampingModel
            onClick={onObjectClick}
            onMeshFound={handleMeshFound}
          />

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