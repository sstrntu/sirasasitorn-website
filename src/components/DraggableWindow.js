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

  const windowRef = useRef(null);

  // Apps that should be full-width on mobile
  const fullWidthApps = ['Messages', 'Notes', 'Maps', 'Terminal'];
  const isFullWidthApp = fullWidthApps.includes(title);

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

      // Touch events
      document.addEventListener('touchmove', handleMove, { passive: false });
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

    // Prevent default to avoid scrolling conflicts on mobile
    e.preventDefault();

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
        style={{ touchAction: 'none' }} // Prevent scrolling when dragging
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

      <div className="window-content">
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;