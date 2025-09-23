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

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        // Constrain to viewport
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, size]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.window-controls')) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
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
      className={`draggable-window ${isMaximized ? 'maximized' : ''}`}
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
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
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