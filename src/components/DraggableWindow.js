import React, { useState, useRef, useEffect } from 'react';
import './DraggableWindow.css';

const DraggableWindow = ({
  children,
  title,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 800, height: 600 },
  onClose,
  onMinimize,
  onMaximize,
  isVisible = true,
  isMinimized = false,
  zIndex = 1000
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [previousState, setPreviousState] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [originalViewportHeight, setOriginalViewportHeight] = useState(window.innerHeight);

  const windowRef = useRef(null);

  // Apps that should be full-width on mobile
  const fullWidthApps = ['Messages', 'Notes', 'Maps', 'Terminal'];
  const isFullWidthApp = fullWidthApps.some(app => title.includes(app));

  // Mobile-specific sizing effect
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;

      if (isMobile && isFullWidthApp && !isMaximized) {
        // Make full-width apps take up most of the screen on mobile
        // Account for dock height (~70px) + bottom margin (~20px) + top margin (~40px)
        setSize({
          width: window.innerWidth - 20, // Small margins
          height: window.innerHeight - 130 // Leave space for dock, margins, status
        });
        setPosition({
          x: 10,
          y: 40
        });
      }
    };

    handleResize(); // Run on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [title, isFullWidthApp, isMaximized]);

  // Keyboard detection and window positioning stabilization for mobile
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const handleViewportChange = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = originalViewportHeight - currentHeight;
      const keyboardThreshold = 150; // Minimum pixels to consider keyboard visible

      const isKeyboardOpen = heightDifference > keyboardThreshold;

      if (isKeyboardOpen !== keyboardVisible) {
        setKeyboardVisible(isKeyboardOpen);

        if (isKeyboardOpen) {
          // Keyboard is visible - adjust window position to stay visible
          // Move window up if it would be hidden by keyboard
          const currentWindowBottom = position.y + size.height;
          const availableHeight = currentHeight - 20; // Small margin from keyboard

          if (currentWindowBottom > availableHeight) {
            const newY = Math.max(10, availableHeight - size.height);
            setPosition(prev => ({ ...prev, y: newY }));
          }
        } else {
          // Keyboard is hidden - restore normal positioning for full-width apps
          if (isFullWidthApp && !isMaximized) {
            setPosition({ x: 10, y: 40 });
            setSize({
              width: window.innerWidth - 20,
              height: window.innerHeight - 130
            });
          }
        }
      }
    };

    // Set initial viewport height
    setOriginalViewportHeight(window.innerHeight);

    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);

    // Better keyboard detection with visual viewport API
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        setOriginalViewportHeight(window.innerHeight);
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
  }, [position, size, keyboardVisible, originalViewportHeight, isFullWidthApp, isMaximized]);

  useEffect(() => {
    const handleMove = (e) => {
      if (isDragging) {
        // Get coordinates from mouse or touch event
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

        if (clientX === undefined || clientY === undefined) return;

        const newX = clientX - dragStart.x;
        const newY = clientY - dragStart.y;

        // Better mobile-friendly constraints
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
          if (isFullWidthApp) {
            // Full-width apps on mobile - restrict horizontal movement more
            const maxX = window.innerWidth - Math.min(size.width, window.innerWidth - 20);
            const maxY = window.innerHeight - Math.min(size.height, window.innerHeight - 60);

            setPosition({
              x: Math.max(5, Math.min(newX, Math.max(5, maxX))), // Keep close to edges
              y: Math.max(30, Math.min(newY, maxY)) // Allow more vertical movement
            });
          } else {
            // Regular mobile windows - normal constraints
            const maxX = window.innerWidth - Math.min(size.width, window.innerWidth - 20);
            const maxY = window.innerHeight - Math.min(size.height, window.innerHeight - 60);

            setPosition({
              x: Math.max(10, Math.min(newX, maxX)),
              y: Math.max(10, Math.min(newY, maxY))
            });
          }
        } else {
          // Desktop behavior - allow some overflow
          const maxX = window.innerWidth - size.width;
          const maxY = window.innerHeight - size.height;

          setPosition({
            x: Math.max(-50, Math.min(newX, maxX + 50)),
            y: Math.max(-20, Math.min(newY, maxY + 50))
          });
        }
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      // Mouse events
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);

      // Touch events - only prevent default when actually dragging the window
      const isMobile = window.innerWidth <= 768;
      document.addEventListener('touchmove', handleMove, {
        passive: !isMobile // On mobile, allow passive scrolling when not dragging
      });
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragStart, size]);

  const handleStart = (e) => {
    if (e.target.closest('.window-controls')) return;

    // Don't start dragging if user is interacting with input elements
    const isInteractiveElement = e.target.tagName === 'INPUT' ||
                                 e.target.tagName === 'TEXTAREA' ||
                                 e.target.tagName === 'BUTTON' ||
                                 e.target.tagName === 'SELECT' ||
                                 e.target.contentEditable === 'true' ||
                                 e.target.closest('input, textarea, button, select, [contenteditable="true"]');

    if (isInteractiveElement) {
      return; // Don't start dragging on interactive elements
    }

    // On mobile, only allow dragging from the header, not from window content
    const isMobile = window.innerWidth <= 768;
    const isHeaderClick = e.target.closest('.window-header') === e.currentTarget;

    if (isMobile && !isHeaderClick) {
      return; // Don't start dragging if not clicking on header on mobile
    }

    // Only prevent default for mouse events or header touches
    if (e.type === 'mousedown' || isHeaderClick) {
      e.preventDefault();
    }

    // Get coordinates from mouse or touch event
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    setIsDragging(true);
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleMinimize = () => {
    if (onMinimize) onMinimize();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      // Restore to previous state
      if (previousState) {
        setPosition(previousState.position);
        setSize(previousState.size);
        setIsMaximized(false);
        setPreviousState(null);
      }
    } else {
      // Save current state and maximize
      setPreviousState({ position, size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsMaximized(true);
    }
    if (onMaximize) onMaximize();
  };

  const handleDoubleClick = () => {
    handleMaximize();
  };

  if (!isVisible || isMinimized) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className={`draggable-window ${isMaximized ? 'maximized' : ''} ${isFullWidthApp ? 'full-width-app' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: zIndex,
        position: 'fixed'
      }}
    >
      <div
        className="window-header"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onDoubleClick={handleDoubleClick}
        style={{ touchAction: 'none' }} // Prevent scrolling when dragging header
      >
        <div className="window-controls">
          <button
            className="control-button close"
            onClick={handleClose}
            title="Close"
          >
            <span className="control-icon">✕</span>
          </button>
          <button
            className="control-button minimize"
            onClick={handleMinimize}
            title="Minimize"
          >
            <span className="control-icon">━</span>
          </button>
          <button
            className="control-button maximize"
            onClick={handleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <span className="control-icon">{isMaximized ? '▢' : '▲'}</span>
          </button>
        </div>
        <div className="window-title">{title}</div>
      </div>

      <div
        className="window-content"
        style={{
          touchAction: window.innerWidth <= 768 ? 'auto' : 'none', // Allow natural scrolling on mobile
          overflowY: window.innerWidth <= 768 ? 'auto' : 'hidden' // Enable scrolling on mobile
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;