import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MacDesktop.css';
import MacDock from './MacDock';
import DraggableWindow from './DraggableWindow';
import TerminalResume from './TerminalResume';
import DraggableDesktopIcon from './DraggableDesktopIcon';
import PDFViewer from './PDFViewer';
import NotesApp from './NotesApp';

const MacDesktop = () => {
  const navigate = useNavigate();
  const [windows, setWindows] = useState({
    terminal: {
      isOpen: true,
      isMinimized: false,
      zIndex: 1000,
      position: { x: 150, y: 100 },
      size: { width: 800, height: 600 }
    },
    pdf: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1001,
      position: { x: 200, y: 150 },
      size: { width: 1400, height: 700 }
    },
    notes: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1002,
      position: { x: 250, y: 100 },
      size: { width: 1000, height: 650 }
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
    } else if (appName === 'pdf') {
      setWindows(prev => ({
        ...prev,
        pdf: {
          ...prev.pdf,
          isOpen: true,
          isMinimized: false,
          zIndex: nextZIndex
        }
      }));
      setNextZIndex(prev => prev + 1);
    } else if (appName === 'notes') {
      setWindows(prev => ({
        ...prev,
        notes: {
          ...prev.notes,
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

      {/* Desktop Icons */}
      <DraggableDesktopIcon
        icon="https://cdn-icons-png.flaticon.com/512/337/337946.png"
        alt="Resume"
        label="Resume.pdf"
        onClick={() => openApp('pdf')}
        initialPosition={{ x: window.innerWidth - 500, y: 130 }}
      />

      <DraggableDesktopIcon
        icon="/turfmapp-icon.png"
        alt="Turfmapp"
        label="Turfmapp"
        onClick={() => window.open('https://turfmapp.com', '_blank')}
        initialPosition={{ x: window.innerWidth - 570, y: 250 }}
      />

      <DraggableDesktopIcon
        icon="/acss-icon.png"
        alt="ACSS"
        label="ACSS"
        onClick={() => window.open('https://www.acsaensaep.co/', '_blank')}
        initialPosition={{ x: window.innerWidth - 450, y: 370 }}
      />

      <DraggableDesktopIcon
        icon="/groundwork10-icon.png"
        alt="Groundwrk 10"
        label="Groundwrk 10"
        onClick={() => window.open('https://www.groundwrk.io/', '_blank')}
        initialPosition={{ x: window.innerWidth - 630, y: 370 }}
      />

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

      {/* PDF Viewer Window */}
      {windows.pdf.isOpen && (
        <DraggableWindow
          title="Information about: Resume"
          initialPosition={windows.pdf.position}
          initialSize={windows.pdf.size}
          isVisible={windows.pdf.isOpen}
          isMinimized={windows.pdf.isMinimized}
          zIndex={windows.pdf.zIndex}
          onClose={() => closeApp('pdf')}
          onMinimize={() => minimizeApp('pdf')}
          onMaximize={() => focusWindow('pdf')}
        >
          <PDFViewer />
        </DraggableWindow>
      )}

      {/* Notes App Window */}
      {windows.notes.isOpen && (
        <DraggableWindow
          title="Notes"
          initialPosition={windows.notes.position}
          initialSize={windows.notes.size}
          isVisible={windows.notes.isOpen}
          isMinimized={windows.notes.isMinimized}
          zIndex={windows.notes.zIndex}
          onClose={() => closeApp('notes')}
          onMinimize={() => minimizeApp('notes')}
          onMaximize={() => focusWindow('notes')}
        >
          <NotesApp />
        </DraggableWindow>
      )}

      {/* Dock */}
      <MacDock onAppClick={openApp} openWindows={windows} />
    </div>
  );
};

export default MacDesktop;