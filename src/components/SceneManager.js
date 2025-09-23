import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CampingScene3D from './CampingScene3D';
import TerminalResume from './TerminalResume';
import './SceneManager.css';

const SceneManager = () => {
  const [currentView, setCurrentView] = useState('3d');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  const handleObjectClick = () => {
    setIsTransitioning(true);

    setTimeout(() => {
      navigate('/pro');
    }, 800);
  };

  const handleBackToScene = () => {
    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentView('3d');
      setIsTransitioning(false);
    }, 800);
  };

  return (
    <div className="scene-manager">
      {isTransitioning && (
        <div className="transition-overlay">
          <div className="transition-text">
            Entering Pro Mode...
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