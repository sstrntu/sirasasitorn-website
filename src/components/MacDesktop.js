import React, { useState, useEffect } from 'react';
import { trackEvent } from '../services/analytics';
import { useNavigate } from 'react-router-dom';
import useArrivalFlag from './useArrivalFlag';
import { DESKTOP_WALLPAPER, SCENE_SCREEN_IMAGE } from '../data/desktopWallpaper';
import { DESKTOP_PROJECTS, RESUME_ICON, openExternal } from '../data/desktopApps';
import './MacDesktop.css';
import MacDock from './MacDock';
import MenuBar from './MenuBar';
import Spotlight from './Spotlight';
import AboutSira from './AboutSira';
import MobileFullscreenApp from './MobileFullscreenApp';
import DraggableWindow from './DraggableWindow';
import TerminalResume from './TerminalResume';
import DraggableDesktopIcon from './DraggableDesktopIcon';
import PDFViewer from './PDFViewer';
import NotesApp from './NotesApp';
import MessagesApp from './MessagesApp';
import MapsApp from './MapsApp';
import { useZoomOutGesture } from './useZoomOutGesture';

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
  // Entered by diving into the laptop screen: fade the desktop's contents in over
  // the matching wallpaper. Cleared afterwards so windows opened later don't fade
  // (and not replayed when the page is refreshed).
  const enteredFromScene = useArrivalFlag('fromScene');
  const [arrivedFromScene, setArrivedFromScene] = useState(enteredFromScene);
  useEffect(() => {
    if (!arrivedFromScene) return undefined;
    const timer = setTimeout(() => setArrivedFromScene(false), 900);
    return () => clearTimeout(timer);
  }, [arrivedFromScene]);
  // Zooming out on the wallpaper (or "Back to Campsite") fades the desktop
  // away and returns to the camp, which opens on the laptop screen and pulls back
  const { ref: zoomOutRef, leave: leaveToScene } = useZoomOutGesture(() =>
    navigate('/', { state: { fromDesktop: true } })
  );
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

  const defaultZIndexMap = {
    terminal: 1000,
    pdf: 1001,
    notes: 1002,
    messages: 1003,
    maps: 1004
  };

  const buildWindowLayouts = () => {
    const terminalSize = getMobileDimensions(800, 550);
    const pdfSize = getMobileDimensions(1400, 700);
    const notesSize = getMobileDimensions(1000, 600);
    const messagesSize = getMobileDimensions(800, 500);
    const mapsSize = getMobileDimensions(1000, 600);

    return {
      terminal: {
        position: getWindowPosition(terminalSize.width, terminalSize.height),
        size: terminalSize
      },
      pdf: {
        position: getWindowPosition(pdfSize.width, pdfSize.height),
        size: pdfSize
      },
      notes: {
        position: getWindowPosition(notesSize.width, notesSize.height),
        size: notesSize
      },
      messages: {
        position: getWindowPosition(messagesSize.width, messagesSize.height, 'messages'),
        size: messagesSize
      },
      maps: {
        position: getWindowPosition(mapsSize.width, mapsSize.height),
        size: mapsSize
      }
    };
  };

  useEffect(() => {
    const layouts = buildWindowLayouts();

    setWindows(prev => {
      const hasExistingWindows = Object.keys(prev).length > 0;

      if (!hasExistingWindows) {
        return {
          terminal: {
            isOpen: false,
            isMinimized: false,
            zIndex: defaultZIndexMap.terminal,
            ...layouts.terminal
          },
          pdf: {
            isOpen: false,
            isMinimized: false,
            zIndex: defaultZIndexMap.pdf,
            ...layouts.pdf
          },
          notes: {
            isOpen: false,
            isMinimized: false,
            zIndex: defaultZIndexMap.notes,
            ...layouts.notes
          },
          messages: {
            isOpen: !isMobile,
            isMinimized: false,
            zIndex: defaultZIndexMap.messages,
            ...layouts.messages
          },
          maps: {
            isOpen: false,
            isMinimized: false,
            zIndex: defaultZIndexMap.maps,
            ...layouts.maps
          }
        };
      }

      const updatedWindows = Object.entries(prev).reduce((acc, [key, value]) => {
        const layout = layouts[key];
        acc[key] = layout
          ? {
              ...value,
              position: layout.position,
              size: layout.size
            }
          : value;
        return acc;
      }, {});

      Object.entries(layouts).forEach(([key, layout]) => {
        if (!updatedWindows[key]) {
          updatedWindows[key] = {
            isOpen: key === 'messages' ? !isMobile : false,
            isMinimized: false,
            zIndex: defaultZIndexMap[key] || 1000,
            ...layout
          };
        }
      });

      return updatedWindows;
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
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);
  const terminalIsOpen = windows.terminal?.isOpen;
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // A command for the terminal to run (from Spotlight or the menu bar); nonce re-runs the same one
  const [terminalCommand, setTerminalCommand] = useState(null);

  // ⌘K / Ctrl+K toggles Spotlight (⌘Space too, where the system doesn't keep it for its own)
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'k' || event.code === 'Space')) {
        event.preventDefault();
        setSpotlightOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // The app whose window is in front, named in the menu bar
  const frontmost = Object.entries(windows)
    .filter(([, win]) => win.isOpen && !win.isMinimized)
    .sort((a, b) => b[1].zIndex - a[1].zIndex)[0]?.[0] || null;

  useEffect(() => {
    if (!isMobile) return;
    if (!isTerminalFullscreen) return;
    if (!terminalIsOpen) return;

    const focusTimeout = setTimeout(() => {
      const inputElement = document.querySelector('.terminal-input');
      if (inputElement) {
        inputElement.focus();
      }
    }, 200);

    return () => clearTimeout(focusTimeout);
  }, [isMobile, isTerminalFullscreen, terminalIsOpen]);

  /** A project's site, in a new tab. */
  const openProject = (name, url) => {
    trackEvent('open_project', 'desktop', name);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openApp = (appName) => {
    trackEvent('open_app', 'desktop', appName);
    if (appName === 'terminal') {
      if (isMobile) {
        setIsTerminalFullscreen(true);
      }
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
    if (appName === 'terminal' && isMobile) {
      setIsTerminalFullscreen(false);
    }
    if (appName === 'terminal') {
      // Reopening it later shouldn't replay the last command
      setTerminalCommand(null);
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

  /** Opens the terminal and runs a command in it. */
  const runInTerminal = (text) => {
    openApp('terminal');
    setTerminalCommand({ text, nonce: Date.now() });
  };

  const runSpotlightAction = (action) => {
    trackEvent('spotlight_open', 'desktop', action.name || action.id || action.command || action.type);
    if (action.type === 'app') {
      openApp(action.id);
    } else if (action.type === 'url' && action.project) {
      openProject(action.name, action.url);
    } else if (action.type === 'url') {
      trackEvent('contact_click', 'desktop', action.name);
      openExternal(action.url);
    } else if (action.type === 'terminal') {
      runInTerminal(action.command);
    } else if (action.type === 'about') {
      setAboutOpen(true);
    } else if (action.type === 'island') {
      leaveToScene();
    }
  };

  const terminalProps = {
    command: terminalCommand,
    onOpenApp: openApp,
    onClose: () => closeApp('terminal'),
    // `ssh island`: back to the desktop first (phones show the terminal full screen), then out to camp
    onLeave: () => {
      closeApp('terminal');
      setTimeout(leaveToScene, 100);
    }
  };

  return (
    <div className="mac-desktop-wrapper" style={zoomWrapperStyle}>
      {isMobile && isTerminalFullscreen && windows.terminal?.isOpen && (
        <MobileFullscreenApp
          title="Terminal"
          theme="dark"
          containerClassName="fullscreen-terminal-container"
          scroll
          onClose={() => closeApp('terminal')}
        >
          <TerminalResume {...terminalProps} />
        </MobileFullscreenApp>
      )}

      {isMobile && isMessagesFullscreen && windows.messages?.isOpen && (
        <MobileFullscreenApp
          title="Messages"
          containerClassName="fullscreen-messages-container"
          onClose={() => closeApp('messages')}
        >
          <MessagesApp />
        </MobileFullscreenApp>
      )}

      {/* Normal Desktop View (hidden when Messages is fullscreen on mobile) */}
      {(!isMobile || (!isMessagesFullscreen && !isTerminalFullscreen)) && (
        <div ref={zoomOutRef} className={`mac-desktop ${arrivedFromScene ? 'arrive-from-scene' : ''}`}>
          {/* Desktop Background */}
          <div
            className="desktop-background"
            style={{
              // The scene's screen image (already cached) shows until the wallpaper loads
              backgroundImage: `url(${DESKTOP_WALLPAPER}), url(${SCENE_SCREEN_IMAGE})`,
              // Phones frame it off-center; it slides to center while zooming out,
              // matching the laptop screen the scene opens on
              backgroundPosition: isMobile ? 'calc(70% - var(--leave, 0) * 20%) center' : 'center'
            }}
          ></div>

          <MenuBar
            isMobile={isMobile}
            windows={windows}
            frontmost={frontmost}
            onOpenApp={openApp}
            onOpenProject={openProject}
            onFocusWindow={openApp}
            onTerminalCommand={runInTerminal}
            onAbout={() => setAboutOpen(true)}
            onSpotlight={() => setSpotlightOpen(true)}
            onLeave={leaveToScene}
          />

          {/* Back to Scene Button - only show when no windows are open */}
          {Object.keys(windows).length > 0 && !Object.values(windows).some(window => window.isOpen && !window.isMinimized) && (
            <button className="back-to-scene-btn" onClick={leaveToScene}>
              ← Back to Campsite
            </button>
          )}

          {/* Desktop Icons */}
          <DraggableDesktopIcon
            icon={RESUME_ICON}
            alt="Resume"
            label="Resume.pdf"
            onClick={() => openApp('pdf')}
            initialPosition={isMobile ? { x: effectiveWidth - 140, y: 30 } : { x: Math.max(20, effectiveWidth - 450), y: 80 }}
          />

          {DESKTOP_PROJECTS.map((project) => (
            <DraggableDesktopIcon
              key={project.name}
              icon={project.icon}
              alt={project.name}
              label={project.name}
              onClick={() => openProject(project.name, project.url)}
              initialPosition={isMobile
                ? { x: effectiveWidth - project.mobile.right, y: project.mobile.y }
                : { x: Math.max(20, effectiveWidth - project.desktop.right), y: project.desktop.y }}
            />
          ))}

          {/* Windows (except Messages when in fullscreen mode) */}
          {windows.terminal?.isOpen && (!isMobile || !isTerminalFullscreen) && (
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
              <TerminalResume {...terminalProps} />
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

          {aboutOpen && (
            <AboutSira
              onClose={() => setAboutOpen(false)}
              onMoreInfo={() => {
                setAboutOpen(false);
                openApp('pdf');
              }}
            />
          )}

          {spotlightOpen && (
            <Spotlight isMobile={isMobile} onClose={() => setSpotlightOpen(false)} onRun={runSpotlightAction} />
          )}
        </div>
      )}
    </div>
  );
};

export default MacDesktop;
