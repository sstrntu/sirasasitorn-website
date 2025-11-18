import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Text, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';

// Note: Detailed model loading disabled by default for performance
// useGLTF.preload('/camping-compressed.glb');

// Enhanced placeholder camping scene - loads instantly
const PlaceholderCampingScene = ({ onClick, targetMeshId, onHoverChange }) => {
  const handleClick = (event) => {
    event.stopPropagation();
    if (onClick) onClick();
  };

  const handlePointerOver = () => {
    document.body.style.cursor = 'pointer';
    if (onHoverChange) onHoverChange(true);
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'default';
    if (onHoverChange) onHoverChange(false);
  };

  return (
    <group scale={[10, 10, 10]} position={[0, -0.3, 0]}>
      {/* Ground base */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.04, 32]} />
        <meshStandardMaterial color="#2d4a1e" />
      </mesh>
      
      {/* Tent structure */}
      <group position={[0, 0, -0.1]}>
        <mesh position={[0, 0.08, 0]} castShadow>
          <coneGeometry args={[0.12, 0.16, 4]} />
          <meshStandardMaterial color="#1a2e0a" />
        </mesh>
        <mesh position={[0, 0.02, 0.08]} castShadow>
          <boxGeometry args={[0.15, 0.04, 0.02]} />
          <meshStandardMaterial color="#0f1a05" />
        </mesh>
      </group>
      
      {/* Laptop - the interactive target */}
      <group position={[0.15, 0.02, 0.05]} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.003, 0.04]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, 0.02, -0.01]} castShadow>
          <boxGeometry args={[0.06, 0.04, 0.003]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Screen glow */}
        <mesh position={[0, 0.02, -0.011]} castShadow>
          <boxGeometry args={[0.055, 0.035, 0.001]} />
          <meshStandardMaterial color="#0066cc" emissive="#001133" />
        </mesh>
      </group>
      
      {/* Campfire area */}
      <group position={[-0.12, 0.03, 0.1]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.02, 0.025, 0.04, 6]} />
          <meshStandardMaterial color="#4a3419" />
        </mesh>
        {/* Fire effect */}
        <mesh position={[0, 0.03, 0]} castShadow>
          <coneGeometry args={[0.015, 0.025, 4]} />
          <meshStandardMaterial color="#ff4444" emissive="#331100" />
        </mesh>
      </group>
      
      {/* Trees for atmosphere */}
      <group position={[-0.3, 0.15, -0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.25, 8]} />
          <meshStandardMaterial color="#3d2f1a" />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <coneGeometry args={[0.08, 0.15, 8]} />
          <meshStandardMaterial color="#1a2e0a" />
        </mesh>
      </group>
      
      <group position={[0.25, 0.12, -0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 8]} />
          <meshStandardMaterial color="#3d2f1a" />
        </mesh>
        <mesh position={[0, 0.15, 0]} castShadow>
          <coneGeometry args={[0.06, 0.12, 8]} />
          <meshStandardMaterial color="#1a2e0a" />
        </mesh>
      </group>
      
      {/* Small details */}
      <mesh position={[0.08, 0.01, 0.12]} castShadow>
        <boxGeometry args={[0.02, 0.02, 0.02]} />
        <meshStandardMaterial color="#4a3419" />
      </mesh>
      
      <mesh position={[-0.05, 0.01, -0.08]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.02, 6]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
    </group>
  );
};

const CampingModel = ({ onClick, targetMeshId, onHoverChange }) => {
  const [useDetailedModel, setUseDetailedModel] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Only load detailed model after user interaction or timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
      setUseDetailedModel(true);
    }, 8000); // Wait 8 seconds before trying detailed model
    
    return () => clearTimeout(timeout);
  }, []);
  
  const gltf = useDetailedModel ? useGLTF('/camping-compressed.glb') : null;
  const mixer = useRef();

  // Hide placeholder once detailed model is loaded
  useEffect(() => {
    if (useDetailedModel && gltf && gltf.scene) {
      const timer = setTimeout(() => {
        setShowPlaceholder(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gltf, useDetailedModel]);
  
  // Fallback: if loading takes too long, stick with placeholder
  useEffect(() => {
    if (useDetailedModel) {
      const fallbackTimer = setTimeout(() => {
        if (showPlaceholder) {
          console.log('Detailed model loading timed out, using placeholder scene');
          setUseDetailedModel(false);
          setShowPlaceholder(true);
        }
      }, 10000); // 10 second fallback
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [useDetailedModel, showPlaceholder]);

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

  if (!useDetailedModel || !gltf || !gltf.scene) {
    return <PlaceholderCampingScene onClick={onClick} targetMeshId={targetMeshId} onHoverChange={onHoverChange} />;
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
    <>
      {/* Show placeholder while detailed model loads or during transition */}
      {showPlaceholder && (
        <PlaceholderCampingScene 
          onClick={handleClick} 
          targetMeshId={targetMeshId} 
          onHoverChange={onHoverChange}
        />
      )}
      
      {/* Detailed model with fade-in - only if successfully loaded */}
      {gltf && gltf.scene && (
        <primitive
          object={gltf.scene}
          scale={[10, 10, 10]}
          position={[0, -0.3, 0]}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          visible={!showPlaceholder}
        />
      )}
    </>
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
        {/* Subtle animated dots */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '0px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#228b22',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0s'
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#228b22',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.3s'
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#228b22',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.6s'
          }} />
        </div>
        
        <style jsx>{`
          @import url("https://fonts.googleapis.com/css2?family=Exo:wght@400;600&display=swap");
          
          @keyframes pulse {
            0%, 100% {
              opacity: 0.3;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
          }
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
        <Suspense fallback={null}>
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
