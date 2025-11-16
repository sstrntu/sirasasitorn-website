import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Text, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';

// Preload the compressed camping model to start loading immediately
useGLTF.preload('/camping-compressed.glb');

const CampingModel = ({ onClick, targetMeshId, onHoverChange }) => {
  const gltf = useGLTF('/camping-compressed.glb');
  const mixer = useRef();

  // Handle click - check if it's the laptop
  const handleClick = (event) => {
    event.stopPropagation();
    if (!onClick) return;

    // Check if clicked object or its parent is the laptop
    let currentObj = event.object;
    while (currentObj) {
      if (currentObj.name === targetMeshId || currentObj.uuid === targetMeshId) {
        onClick(); // Laptop clicked!
        return;
      }
      currentObj = currentObj.parent;
    }
    // Not the laptop, ignore click
  };

  // Handle hover
  const handlePointerOver = (event) => {
    event.stopPropagation();
    let currentObj = event.object;
    while (currentObj) {
      if (currentObj.name === targetMeshId || currentObj.uuid === targetMeshId) {
        document.body.style.cursor = 'pointer';
        if (onHoverChange) onHoverChange(true);
        return;
      }
      currentObj = currentObj.parent;
    }
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'default';
    if (onHoverChange) onHoverChange(false);
  };

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



  // Set up animations
  useEffect(() => {
    if (gltf.animations && gltf.animations.length > 0) {
      mixer.current = new THREE.AnimationMixer(gltf.scene);

      // Play all animations
      gltf.animations.forEach((clip) => {
        const action = mixer.current.clipAction(clip);
        action.play();
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
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
};

const CameraAnimation = ({ controlsRef }) => {
  const { camera } = useThree();
  const animationStartTimeRef = useRef(null);
  const animationCompleteRef = useRef(false);

  // Check if mobile device
  const isMobile = window.innerWidth <= 768;

  // Starting position (far away)
  const startPosition = new THREE.Vector3(12.15, 2.41, 8.46);
  // Default end position (close zoom)
  const defaultEndPosition = isMobile
    ? new THREE.Vector3(1.73, 0.00, 0.59) // Mobile position
    : new THREE.Vector3(1.36, 0.25, 1.20); // Desktop position

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
    // Initial animation (scene overview)
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
        camera.position.lerpVectors(startPosition, defaultEndPosition, easedProgress);
        camera.lookAt(0, 0, 0);
      } else {
        // Animation complete - set final position and enable controls for free exploration
        camera.position.copy(defaultEndPosition);
        camera.lookAt(0, 0, 0);
        animationCompleteRef.current = true;

        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.minDistance = 1;
          controlsRef.current.maxDistance = 15;
          controlsRef.current.enabled = true; // Enable controls for user interaction
          controlsRef.current.update();
        }
      }
    }
  });

  return null;
};


const LoadingScreen = () => {
  const { active, progress, errors, item, loaded, total } = useProgress();
  
  return (
    <Html center>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: '"Exo", Arial, sans-serif',
        color: '#ffffff',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '18px',
          marginBottom: '20px',
          fontWeight: 600
        }}>
          Loading Camping Scene
        </div>
        
        {/* Progress bar */}
        <div style={{
          width: '200px',
          height: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '10px'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#228b22',
            borderRadius: '3px',
            transition: 'width 0.3s ease-in-out'
          }} />
        </div>
        
        {/* Progress text */}
        <div style={{
          fontSize: '14px',
          opacity: 0.8
        }}>
          {Math.round(progress)}% ({loaded} / {total} assets)
        </div>
        
        {/* Loading file info */}
        {item && (
          <div style={{
            fontSize: '12px',
            opacity: 0.6,
            marginTop: '5px',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Loading: {item}
          </div>
        )}
        
        {/* Error display */}
        {errors.length > 0 && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            marginTop: '10px'
          }}>
            Error loading assets
          </div>
        )}
        
        <style jsx>{`
          @import url("https://fonts.googleapis.com/css2?family=Exo:wght@400;600&display=swap");
        `}</style>
      </div>
    </Html>
  );
};

const CampingScene3D = ({ onObjectClick, targetMeshId = 'abgVijaHVNRUvcc' }) => {
  const controlsRef = useRef();
  const [isHoveringLaptop, setIsHoveringLaptop] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // Function to handle laptop click
  const handleLaptopClick = () => {
    setShowInstructions(false);
    
    // Navigate immediately with overlay
    if (onObjectClick) {
      onObjectClick();
    }
  };

  // Hide instructions after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

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
            onClick={handleLaptopClick}
            targetMeshId={targetMeshId}
            onHoverChange={setIsHoveringLaptop}
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

      {/* Instruction text */}
      {showInstructions && (
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '18px',
          fontFamily: '"Exo", Arial, sans-serif',
          textAlign: 'center',
          padding: '15px 30px',
          background: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '10px',
          backdropFilter: 'blur(10px)',
          animation: 'fadeInOut 2s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <div style={{ marginBottom: '5px' }}>👇 Explore the scene</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Click the laptop to enter</div>
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CampingScene3D;
