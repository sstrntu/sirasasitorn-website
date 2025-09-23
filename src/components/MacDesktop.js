import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MacDesktop.css';
import MacDock from './MacDock';
import DraggableWindow from './DraggableWindow';
import TerminalResume from './TerminalResume';

const MacDesktop = () => {
  const navigate = useNavigate();
  const [windows, setWindows] = useState({
    terminal: {
      isOpen: true,
      isMinimized: false,
      zIndex: 1000,
      position: { x: 150, y: 100 },
      size: { width: 800, height: 600 }
    }
  });

  const [nextZIndex, setNextZIndex] = useState(1001);

  const handleBackToScene = () => {
    navigate('/');
  };

  const openApp = (appName) => {
    if (appName === 'terminal') {
      setWindows(prev => ({
        ...prev,
        terminal: {
          ...prev.terminal,
          isOpen: true,
          isMinimized: false,
          zIndex: nextZIndex
        }
      }));
      setNextZIndex(prev => prev + 1);
    }
  };

  const closeApp = (appName) => {
    setWindows(prev => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        isOpen: false
      }
    }));
  };

  const minimizeApp = (appName) => {
    setWindows(prev => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        isMinimized: !prev[appName].isMinimized
      }
    }));
  };

  const focusWindow = (appName) => {
    setWindows(prev => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        zIndex: nextZIndex
      }
    }));
    setNextZIndex(prev => prev + 1);
  };

  const handleDesktopClick = (e) => {
    if (e.target === e.currentTarget) {
      // Clicked on desktop background - could implement desktop context menu here
    }
  };

  return (
    <div className="mac-desktop" onClick={handleDesktopClick}>
      {/* Desktop Background */}
      <div className="desktop-background"></div>

      {/* Back to Scene Button */}
      <button className="back-to-scene-btn" onClick={handleBackToScene}>
        ← Back to Campsite
      </button>

      {/* Windows */}
      {windows.terminal.isOpen && (
        <DraggableWindow
          title="Terminal — sirasasitorn@terminal: ~"
          initialPosition={windows.terminal.position}
          initialSize={windows.terminal.size}
          isVisible={windows.terminal.isOpen}
          isMinimized={windows.terminal.isMinimized}
          zIndex={windows.terminal.zIndex}
          onClose={() => closeApp('terminal')}
          onMinimize={() => minimizeApp('terminal')}
          onMaximize={() => focusWindow('terminal')}
        >
          <TerminalResume />
        </DraggableWindow>
      )}

      {/* Dock */}
      <MacDock onAppClick={openApp} openWindows={windows} />
    </div>
  );
};

export default MacDesktop;