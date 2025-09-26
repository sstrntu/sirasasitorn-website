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
    zoomLevel: 1, // Always 1 for consistent mobile behavior
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        zoomLevel: 1, // Always 1 for consistent mobile behavior
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
  const {
    width: windowWidth,
    height: windowHeight,
    zoomLevel
  } = useWindowDimensions();

  const normalizedZoom = zoomLevel || 1;
  // On mobile, ignore zoom calculations that can cause layout issues
  const isMobile = windowWidth <= 768;
  const effectiveWidth = isMobile ? windowWidth : windowWidth * normalizedZoom;
  const effectiveHeight = isMobile ? windowHeight : windowHeight * normalizedZoom;

  // Keyboard detection states
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [originalHeight, setOriginalHeight] = useState(window.innerHeight);

  // Disable scaling on mobile to prevent layout issues
  const rawScale = isMobile ? 1 : (normalizedZoom > 0 ? 1 / normalizedZoom : 1);
  const scale = Math.abs(rawScale - 1) < 0.001 ? 1 : rawScale;
  const zoomWrapperStyle = !isMobile && scale !== 1 ? {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${(100 / scale).toFixed(4)}%`,
    height: `${(100 / scale).toFixed(4)}%`
  } : undefined;

  // Debug logging for size investigation
  useEffect(() => {
    console.log('MacDesktop dimensions:', {
      windowWidth,
      windowHeight,
      effectiveWidth,
      effectiveHeight,
      isMobile,
      zoomLevel: normalizedZoom,
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
  }, [windowWidth, windowHeight, effectiveWidth, effectiveHeight, isMobile, normalizedZoom]);

  // Helper function to calculate window position
  const getWindowPosition = (winWidth, winHeight, appName = '') => {
    const screenWidth = effectiveWidth;
    const screenHeight = effectiveHeight;
    const dockHeight = 80; // Height of the dock
    const topBarHeight = 50; // Height of the top bar/header

    // Adjust for keyboard visibility on mobile
    let availableHeight = screenHeight - dockHeight - topBarHeight;
    if (isMobile && keyboardVisible) {
      // When keyboard is visible, use the reduced viewport height
      availableHeight = viewportHeight - dockHeight - topBarHeight;
    }

    // For mobile, center the popup windows
    if (isMobile) {
      return {
        x: Math.max(20, (screenWidth - winWidth) / 2),
        y: Math.max(topBarHeight + 20, (availableHeight - winHeight) / 2 + topBarHeight)
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

    // For mobile, create popup-style windows with better proportions
    const availableWidth = effectiveWidth - 60; // 30px margins on each side

    // Adjust available height based on keyboard visibility
    let baseHeight = effectiveHeight;
    if (keyboardVisible) {
      baseHeight = viewportHeight;
    }

    const availableHeight = baseHeight - 200; // Space for dock (80px) + header (50px) + margins (70px)

    // Use 85% of available space with better aspect ratio
    const popupWidth = Math.min(availableWidth * 0.85, 380);
    const popupHeight = Math.min(availableHeight * 0.75, 450);

    return {
      width: popupWidth,
      height: popupHeight
    };
  };

  const [windows, setWindows] = useState({});

  // Initialize window configurations after component mounts
  useEffect(() => {
    const terminalSize = getMobileDimensions(800, 550);
    const pdfSize = getMobileDimensions(1400, 700);
    const notesSize = getMobileDimensions(1000, 600);
    const messagesSize = getMobileDimensions(800, 500);
    const mapsSize = getMobileDimensions(1000, 600);

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
        isOpen: !isMobile, // Only open by default on desktop, not mobile
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
  }, [effectiveWidth, effectiveHeight, isMobile, keyboardVisible, viewportHeight]);

  // Keyboard detection effect for mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleViewportChange = () => {
      const currentHeight = window.innerHeight;
      setViewportHeight(currentHeight);

      // Detect keyboard visibility by checking if viewport height decreased significantly
      const heightDifference = originalHeight - currentHeight;
      const keyboardThreshold = 150; // Minimum pixels to consider keyboard visible

      const isKeyboardOpen = heightDifference > keyboardThreshold;

      if (isKeyboardOpen !== keyboardVisible) {
        setKeyboardVisible(isKeyboardOpen);
        console.log('Keyboard visibility changed:', {
          isVisible: isKeyboardOpen,
          originalHeight,
          currentHeight,
          heightDifference
        });

        // Automatically scroll to ensure active window is visible
        if (isKeyboardOpen) {
          setTimeout(() => {
            const activeWindow = document.querySelector('.draggable-window:not(.minimized)');
            if (activeWindow) {
              activeWindow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 300);
        }
      }
    };

    // Set initial height
    setOriginalHeight(window.innerHeight);
    setViewportHeight(window.innerHeight);

    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);

    // Also listen for visual viewport changes (better for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Orientation change can affect keyboard detection
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        setOriginalHeight(window.innerHeight);
        handleViewportChange();
      }, 500);
    });

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [isMobile, keyboardVisible, originalHeight]);

  const [nextZIndex, setNextZIndex] = useState(1005);
  const [isMessagesFullscreen, setIsMessagesFullscreen] = useState(false);

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
      // Enter fullscreen mode for Messages app only on mobile
      if (isMobile) {
        setIsMessagesFullscreen(true);
      }
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
    // Exit fullscreen mode if closing Messages app on mobile
    if (appName === 'messages' && isMobile) {
      setIsMessagesFullscreen(false);
    }

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
    <div className="mac-desktop-wrapper" style={zoomWrapperStyle}>
      {/* Fullscreen Messages App - Mobile Only */}
      {isMobile && isMessagesFullscreen && windows.messages?.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            backgroundColor: '#ffffff'
          }}
        >
          <div
            className="window-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: '#fafafa'
            }}
          >
            <div className="window-controls" style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => closeApp('messages')}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#ff5f57',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title="Close"
              >
                <span style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '8px',
                  color: '#fff',
                  lineHeight: '1'
                }}>✕</span>
              </button>
              <button
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#ffbd2e',
                  cursor: 'pointer'
                }}
                title="Minimize"
              >
              </button>
              <button
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#28ca42',
                  cursor: 'pointer'
                }}
                title="Maximize"
              >
              </button>
            </div>
            <div className="window-title" style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#333',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}>
              Messages
            </div>
          </div>
          <div style={{ height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
            <MessagesApp />
          </div>
        </div>
      )}

      {/* Normal Desktop View (hidden when Messages is fullscreen on mobile) */}
      {(!isMobile || !isMessagesFullscreen) && (
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
            initialPosition={isMobile ? { x: effectiveWidth - 140, y: 30 } : { x: Math.max(20, effectiveWidth - 450), y: 80 }}
          />

          <DraggableDesktopIcon
            icon="/turfmapp-icon.png"
            alt="Turfmapp"
            label="Turfmapp"
            onClick={() => window.open('https://turfmapp.com', '_blank')}
            initialPosition={isMobile ? { x: effectiveWidth - 70, y: 90 } : { x: Math.max(20, effectiveWidth - 570), y: 120 }}
          />

          <DraggableDesktopIcon
            icon="/acss-icon.png"
            alt="ACSS"
            label="ACSS"
            onClick={() => window.open('https://www.acsaensaep.co/', '_blank')}
            initialPosition={isMobile ? { x: effectiveWidth - 140, y: 150 } : { x: Math.max(20, effectiveWidth - 250), y: 220 }}
          />

          <DraggableDesktopIcon
            icon="/groundwork10-icon.png"
            alt="Groundwrk 10"
            label="Groundwrk 10"
            onClick={() => window.open('https://www.groundwrk.io/', '_blank')}
            initialPosition={isMobile ? { x: effectiveWidth - 70, y: 210 } : { x: Math.max(20, effectiveWidth - 350), y: 200 }}
          />

          {/* Windows (except Messages when in fullscreen mode) */}
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

          {/* Messages App Window - show on desktop or mobile when not fullscreen */}
          {windows.messages?.isOpen && (!isMobile || !isMessagesFullscreen) && (
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
      )}
    </div>
  );
};

export default MacDesktop;
