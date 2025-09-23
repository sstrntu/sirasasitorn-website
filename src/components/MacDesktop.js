import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MacDesktop.css';
import MacDock from './MacDock';
import DraggableWindow from './DraggableWindow';
import TerminalResume from './TerminalResume';
import DraggableDesktopIcon from './DraggableDesktopIcon';
import PDFViewer from './PDFViewer';
import NotesApp from './NotesApp';
import MessagesApp from './MessagesApp';
import MapsApp from './MapsApp';

const MacDesktop = () => {
  const navigate = useNavigate();

  // Helper function to calculate centered position
  const getCenteredPosition = (windowWidth, windowHeight) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    return {
      x: Math.max(0, (screenWidth - windowWidth) / 2),
      y: Math.max(50, (screenHeight - windowHeight) / 2 - 50) // Account for dock height
    };
  };

  const [windows, setWindows] = useState({
    terminal: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1000,
      position: getCenteredPosition(800, 600),
      size: { width: 800, height: 600 }
    },
    pdf: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1001,
      position: getCenteredPosition(1400, 700),
      size: { width: 1400, height: 700 }
    },
    notes: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1002,
      position: getCenteredPosition(1000, 650),
      size: { width: 1000, height: 650 }
    },
    messages: {
      isOpen: true,
      isMinimized: false,
      zIndex: 1003,
      position: getCenteredPosition(1500, 700),
      size: { width: 900, height: 700 }
    },
    maps: {
      isOpen: false,
      isMinimized: false,
      zIndex: 1004,
      position: getCenteredPosition(1000, 650),
      size: { width: 1000, height: 650 }
    }
  });

  const [nextZIndex, setNextZIndex] = useState(1005);

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
    } else if (appName === 'messages') {
      setWindows(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          isOpen: true,
          isMinimized: false,
          zIndex: nextZIndex
        }
      }));
      setNextZIndex(prev => prev + 1);
    } else if (appName === 'maps') {
      setWindows(prev => ({
        ...prev,
        maps: {
          ...prev.maps,
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

  return (
    <div className="mac-desktop">
      {/* Desktop Background */}
      <div
        className="desktop-background"
        style={{
          backgroundImage: 'url(/background1.png)'
        }}
      ></div>

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
        initialPosition={{ x: window.innerWidth - 550, y: 130 }}
      />

      <DraggableDesktopIcon
        icon="/turfmapp-icon.png"
        alt="Turfmapp"
        label="Turfmapp"
        onClick={() => window.open('https://turfmapp.com', '_blank')}
        initialPosition={{ x: window.innerWidth - 670, y: 170 }}
      />

      <DraggableDesktopIcon
        icon="/acss-icon.png"
        alt="ACSS"
        label="ACSS"
        onClick={() => window.open('https://www.acsaensaep.co/', '_blank')}
        initialPosition={{ x: window.innerWidth - 350, y: 270 }}
      />

      <DraggableDesktopIcon
        icon="/groundwork10-icon.png"
        alt="Groundwrk 10"
        label="Groundwrk 10"
        onClick={() => window.open('https://www.groundwrk.io/', '_blank')}
        initialPosition={{ x: window.innerWidth - 450, y: 250 }}
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

      {/* Messages App Window */}
      {windows.messages.isOpen && (
        <DraggableWindow
          title="Messages"
          initialPosition={windows.messages.position}
          initialSize={windows.messages.size}
          isVisible={windows.messages.isOpen}
          isMinimized={windows.messages.isMinimized}
          zIndex={windows.messages.zIndex}
          onClose={() => closeApp('messages')}
          onMinimize={() => minimizeApp('messages')}
          onMaximize={() => focusWindow('messages')}
        >
          <MessagesApp />
        </DraggableWindow>
      )}

      {/* Maps App Window */}
      {windows.maps.isOpen && (
        <DraggableWindow
          title="Maps"
          initialPosition={windows.maps.position}
          initialSize={windows.maps.size}
          isVisible={windows.maps.isOpen}
          isMinimized={windows.maps.isMinimized}
          zIndex={windows.maps.zIndex}
          onClose={() => closeApp('maps')}
          onMinimize={() => minimizeApp('maps')}
          onMaximize={() => focusWindow('maps')}
        >
          <MapsApp />
        </DraggableWindow>
      )}

      {/* Dock */}
      <MacDock onAppClick={openApp} openWindows={windows} />
    </div>
  );
};

export default MacDesktop;