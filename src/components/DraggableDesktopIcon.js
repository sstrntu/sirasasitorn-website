import React, { useState, useRef } from 'react';
import './DraggableDesktopIcon.css';

const DraggableDesktopIcon = ({ icon, alt, label, onClick, initialPosition = { x: 20, y: 20 } }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    // Only trigger onClick if we weren't dragging
    if (!isDragging && onClick) {
      onClick();
    }
  };

  // Add global mouse event listeners when dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
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
      onMouseDown={handleMouseDown}
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