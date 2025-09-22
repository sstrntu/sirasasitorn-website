import React, { useState } from 'react';
import CampingScene3D from './CampingScene3D';
import TerminalResume from './TerminalResume';
import './SceneManager.css';

const SceneManager = () => {
  const [currentView, setCurrentView] = useState('3d');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleObjectClick = () => {
    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentView('terminal');
      setIsTransitioning(false);
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
            {currentView === '3d' ? 'Entering terminal...' : 'Returning to camp...'}
          </div>
          <div className="loading-bar">
            <div className="loading-fill"></div>
          </div>
        </div>
      )}

      {currentView === '3d' && (
        <div className={`view-container ${isTransitioning ? 'view-fade-out' : 'view-fade-in'}`}>
          <CampingScene3D onObjectClick={handleObjectClick} />
        </div>
      )}

      {currentView === 'terminal' && (
        <div className={`view-container ${isTransitioning ? 'view-fade-out' : 'view-fade-in'}`}>
          <div className="terminal-container-wrapper">
            <button className="back-to-scene-btn" onClick={handleBackToScene}>
              ← Back to Campsite
            </button>
            <TerminalResume />
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneManager;