import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CampingScene3D from './CampingScene3D';
import './SceneManager.css';

const SceneManager = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  const handleObjectClick = () => {
    // This is called 3 seconds after laptop click (after camera animation)
    setIsTransitioning(true);

    // Navigate shortly after showing overlay
    setTimeout(() => {
      navigate('/pro');
    }, 500);
  };

  return (
    <div className="scene-manager">
      {isTransitioning && (
        <div className="transition-overlay">
          <div className="transition-text">
            Entering Sira's Computer
          </div>
          <div className="loading-bar">
            <div className="loading-fill"></div>
          </div>
        </div>
      )}

      <div className={`view-container ${isTransitioning ? 'view-fade-out' : 'view-fade-in'}`}>
        <CampingScene3D onObjectClick={handleObjectClick} />
      </div>
    </div>
  );
};

export default SceneManager;
