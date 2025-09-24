import React, { useState, useEffect } from 'react';
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

// Custom hook for window dimensions
const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial dimensions after component mounts
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
};

const MacDesktop = () => {
  const navigate = useNavigate();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Debug logging for size investigation
  useEffect(() => {
    console.log('MacDesktop dimensions:', {
      windowWidth,
      windowHeight,
      isMobile,
      devicePixelRatio: window.devicePixelRatio || 1,
      userAgent: navigator.userAgent,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screen: {
        width: window.screen?.width,
        height: window.screen?.height,
        availWidth: window.screen?.availWidth,
        availHeight: window.screen?.availHeight
      }
    });
  }, [windowWidth, windowHeight, isMobile]);

  // Check if mobile device using current window dimensions
  const isMobile = windowWidth <= 768;

  // Helper function to calculate window position
  const getWindowPosition = (winWidth, winHeight, appName = '') => {
    const screenWidth = windowWidth;
    const screenHeight = windowHeight;
    const dockHeight = 80; // Height of the dock
    const topBarHeight = 50; // Height of the top bar/header
    const availableHeight = screenHeight - dockHeight - topBarHeight;

    // For mobile, adjust window size to fit available space
    if (isMobile) {
      const mobileWidth = Math.min(winWidth, screenWidth - 40); // 20px margin on each side
      const mobileHeight = Math.min(winHeight, availableHeight - 40); // 20px margin top/bottom

      return {
        x: Math.max(20, (screenWidth - mobileWidth) / 2),
        y: Math.max(topBarHeight + 20, topBarHeight + (availableHeight - mobileHeight) / 2)
      };
    }

    // For desktop - Messages app gets specific positioning
    if (appName === 'messages') {
      return {
        x: 100, // Left side with 50px margin
        y: Math.max(topBarHeight + 50, topBarHeight + 50) // Top-left area
      };
    }

    // For other apps - centered position
    return {
      x: Math.max(0, (screenWidth - winWidth) / 2),
      y: Math.max(topBarHeight, Math.min(
        (availableHeight - winHeight) / 2 + topBarHeight,
        availableHeight - winHeight + topBarHeight - 20
      ))
    };
  };

  // Calculate mobile-friendly dimensions
  const getMobileDimensions = (desktopWidth, desktopHeight) => {
    if (!isMobile) return { width: desktopWidth, height: desktopHeight };

    const dockHeight = 80;
    const topBarHeight = 50;
    const margins = 40; // 20px on each side
    const availableHeight = windowHeight - dockHeight - topBarHeight - margins;
    const availableWidth = windowWidth - margins;

    return {
      width: availableWidth,
      height: Math.min(desktopHeight, availableHeight)
    };
  };

  const [windows, setWindows] = useState({});

  // Initialize window configurations after component mounts
  useEffect(() => {
    const terminalSize = getMobileDimensions(800, 600);
    const pdfSize = getMobileDimensions(1400, 700);
    const notesSize = getMobileDimensions(1000, 650);
    const messagesSize = getMobileDimensions(900, 700);
    const mapsSize = getMobileDimensions(1000, 650);

    setWindows({
      terminal: {
        isOpen: false,
        isMinimized: false,
        zIndex: 1000,
        position: getWindowPosition(terminalSize.width, terminalSize.height),
        size: terminalSize
      },
      pdf: {
        isOpen: false,
        isMinimized: false,
        zIndex: 1001,
        position: getWindowPosition(pdfSize.width, pdfSize.height),
        size: pdfSize
      },
      notes: {
        isOpen: false,
        isMinimized: false,
        zIndex: 1002,
        position: getWindowPosition(notesSize.width, notesSize.height),
        size: notesSize
      },
      messages: {
        isOpen: !isMobile, // Only open by default on desktop
        isMinimized: false,
        zIndex: 1003,
        position: getWindowPosition(messagesSize.width, messagesSize.height, 'messages'),
        size: messagesSize
      },
      maps: {
        isOpen: false,
        isMinimized: false,
        zIndex: 1004,
        position: getWindowPosition(mapsSize.width, mapsSize.height),
        size: mapsSize
      }
    });
  }, [windowWidth, windowHeight, isMobile]);

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
          backgroundImage: 'url(/background1.png)',
          backgroundPosition: isMobile ? '70% center' : 'center'
        }}
      ></div>

      {/* Back to Scene Button - only show when no windows are open */}
      {Object.keys(windows).length > 0 && !Object.values(windows).some(window => window.isOpen && !window.isMinimized) && (
        <button className="back-to-scene-btn" onClick={handleBackToScene}>
          ← Back to Campsite
        </button>
      )}

      {/* Desktop Icons */}
      <DraggableDesktopIcon
        icon="https://cdn-icons-png.flaticon.com/512/337/337946.png"
        alt="Resume"
        label="Resume.pdf"
        onClick={() => openApp('pdf')}
        initialPosition={isMobile ? { x: 20, y: 130 } : { x: windowWidth - 550, y: 130 }}
      />

      <DraggableDesktopIcon
        icon="/turfmapp-icon.png"
        alt="Turfmapp"
        label="Turfmapp"
        onClick={() => window.open('https://turfmapp.com', '_blank')}
        initialPosition={isMobile ? { x: 110, y: 130 } : { x: windowWidth - 670, y: 170 }}
      />

      <DraggableDesktopIcon
        icon="/acss-icon.png"
        alt="ACSS"
        label="ACSS"
        onClick={() => window.open('https://www.acsaensaep.co/', '_blank')}
        initialPosition={isMobile ? { x: 20, y: 240 } : { x: windowWidth - 350, y: 270 }}
      />

      <DraggableDesktopIcon
        icon="/groundwork10-icon.png"
        alt="Groundwrk 10"
        label="Groundwrk 10"
        onClick={() => window.open('https://www.groundwrk.io/', '_blank')}
        initialPosition={isMobile ? { x: 110, y: 240 } : { x: windowWidth - 450, y: 250 }}
      />

      {/* Windows */}
      {windows.terminal?.isOpen && (
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
      {windows.pdf?.isOpen && (
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
      {windows.notes?.isOpen && (
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
      {windows.messages?.isOpen && (
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
      {windows.maps?.isOpen && (
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