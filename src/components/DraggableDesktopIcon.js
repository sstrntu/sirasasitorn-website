import React, { useState, useRef } from 'react';
import './DraggableDesktopIcon.css';

const DraggableDesktopIcon = ({ icon, alt, label, onClick, initialPosition = { x: 20, y: 20 } }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);

  const handleStart = (e) => {
    // Get coordinates from mouse or touch event
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    setIsDragging(true);
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
    e.preventDefault();
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    // Get coordinates from mouse or touch event
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;

    // Get desktop bounds to keep icon within viewport
    const desktop = document.querySelector('.mac-desktop');
    const iconElement = iconRef.current;

    if (desktop && iconElement) {
      const desktopRect = desktop.getBoundingClientRect();
      const iconRect = iconElement.getBoundingClientRect();

      const maxX = desktopRect.width - iconRect.width;
      const maxY = desktopRect.height - iconRect.height;

      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: boundedX, y: boundedY });
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    // Only trigger onClick if we weren't dragging
    if (!isDragging && onClick) {
      onClick();
    }
  };

  // Add global mouse and touch event listeners when dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div
      ref={iconRef}
      className={`draggable-desktop-icon ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 10000 : 100
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={handleClick}
    >
      <img
        src={icon}
        alt={alt}
        draggable={false}
        onError={(e) => {
          console.error(`Failed to load icon: ${icon}`, e);
        }}
        onLoad={(e) => {
          console.log(`Successfully loaded icon: ${icon}`);
        }}
      />
      <span>{label}</span>
    </div>
  );
};

export default DraggableDesktopIcon;