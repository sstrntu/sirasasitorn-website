import React from 'react';

const THEMES = {
  dark: { zIndex: 99998, background: '#1b1b1b', headerBorder: '#2a2a2a', headerBackground: '#161616', title: '#f0f0f0' },
  light: { zIndex: 99999, background: '#ffffff', headerBorder: '#e0e0e0', headerBackground: '#fafafa', title: '#333' },
};

const trafficLight = (color) => ({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: color,
  cursor: 'pointer'
});

const stopPropagation = (e) => e.stopPropagation();

/**
 * An app filling a phone's screen (Terminal and Messages on mobile), under a
 * Mac-style title bar whose red button closes it.
 */
const MobileFullscreenApp = ({ title, theme = 'light', containerClassName, scroll = false, onClose, children }) => {
  const colors = THEMES[theme];
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: colors.zIndex,
        backgroundColor: colors.background
      }}
      onClick={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchEnd={stopPropagation}
    >
      <div
        className="window-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: `1px solid ${colors.headerBorder}`,
          backgroundColor: colors.headerBackground
        }}
      >
        <div className="window-controls" style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ ...trafficLight('#ff5f57'), position: 'relative' }} title="Close">
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
          <button style={trafficLight('#ffbd2e')} title="Minimize"></button>
          <button style={trafficLight('#28ca42')} title="Maximize"></button>
        </div>
        <div className="window-title" style={{
          fontWeight: 600,
          fontSize: '14px',
          color: colors.title,
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          {title}
        </div>
      </div>
      <div
        className={containerClassName}
        style={{
          height: 'calc(100dvh - 50px)',
          ...(scroll ? { overflow: 'auto' } : null)
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default MobileFullscreenApp;
