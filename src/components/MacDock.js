import React, { useState, useEffect } from 'react';
import './MacDock.css';

const MacDock = ({ onAppClick, openWindows = {} }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({ isChrome: false, isSafari: false, isIOS: false });

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;

      // Detect browser types
      const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
      const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
      const isIOS = /iphone|ipad|ipod/.test(userAgent);

      setIsMobile(isMobileDevice || isSmallScreen);
      setBrowserInfo({ isChrome, isSafari, isIOS });

      console.log('Mobile detection:', {
        isMobileDevice,
        isSmallScreen,
        isChrome,
        isSafari,
        isIOS,
        userAgent
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const dockApps = [
    {
      name: 'Messages',
      id: 'messages',
      icon: 'https://raw.githubusercontent.com/lucasromerodb/liquid-glass-effect-macos/refs/heads/main/assets/messages.png',
      onClick: () => onAppClick ? onAppClick('messages') : console.log('Messages clicked')
    },
    {
      name: 'Mail',
      id: 'mail',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Mail_%28iOS%29.svg',
      onClick: () => window.open('mailto:sirasasitorn@gmail.com', '_blank')
    },
    {
      name: 'Notes',
      id: 'notes',
      icon: 'https://icons.iconarchive.com/icons/hamzasaleem/stock-style-3/512/Notes-icon.png',
      onClick: () => onAppClick ? onAppClick('notes') : console.log('Notes clicked')
    },
    {
      name: 'Instagram',
      id: 'instagram',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
      onClick: () => window.open('https://www.instagram.com/siratu/', '_blank')
    },
    {
      name: 'LinkedIn',
      id: 'linkedin',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',
      onClick: () => window.open('https://linkedin.com/in/sirasasitorn/', '_blank')
    },
    {
      name: 'Maps',
      id: 'maps',
      icon: 'https://raw.githubusercontent.com/lucasromerodb/liquid-glass-effect-macos/refs/heads/main/assets/map.png',
      onClick: () => onAppClick ? onAppClick('maps') : console.log('Maps clicked')
    },
    {
      name: 'Terminal',
      id: 'terminal',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Terminalicon2.png',
      onClick: () => onAppClick ? onAppClick('terminal') : console.log('Terminal clicked')
    }
  ];

  // Calculate dynamic bottom position for mobile browsers
  const getDynamicBottomPosition = () => {
    if (!isMobile) return undefined;

    if (browserInfo.isIOS && browserInfo.isSafari) {
      // Safari iOS needs extra space for navigation bar
      return 'calc(env(safe-area-inset-bottom, 0px) + 25px)';
    } else if (browserInfo.isChrome) {
      // Chrome mobile might hide/show address bar
      return '20px';
    }
    return '15px';
  };

  const dynamicClasses = [
    'mac-dock-wrapper',
    isMobile ? 'mobile' : 'desktop',
    browserInfo.isChrome ? 'chrome-mobile' : '',
    browserInfo.isSafari ? 'safari-mobile' : '',
    browserInfo.isIOS ? 'ios-device' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={dynamicClasses}
      style={{
        display: 'flex',
        visibility: 'visible',
        opacity: 1,
        position: 'fixed',
        bottom: getDynamicBottomPosition(),
        zIndex: isMobile ? 99999 : 1000,
        pointerEvents: 'auto',
        transform: 'translateX(-50%)'
      }}
    >
      <div className="liquidGlass-wrapper dock">
        <div className="liquidGlass-effect"></div>
        <div className="liquidGlass-tint"></div>
        <div className="liquidGlass-shine"></div>
        <div className="liquidGlass-text">
          <div className="dock" style={{ display: 'flex' }}>
            {dockApps.map((app, index) => (
              <div key={index} className="dock-app-container">
                <img
                  src={app.icon}
                  alt={app.name}
                  title={app.name}
                  onClick={app.onClick}
                  className={`dock-app-icon ${openWindows[app.id]?.isOpen ? 'running' : ''}`}
                  style={{ display: 'block' }}
                />
                {openWindows[app.id]?.isOpen && !openWindows[app.id]?.isMinimized && (
                  <div className="app-indicator"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <svg style={{ display: 'none' }}>
        <filter
          id="glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01 0.01"
            numOctaves="1"
            seed="5"
            result="turbulence"
          />

          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>

          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />

          <feSpecularLighting
            in="softMap"
            surfaceScale="5"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>

          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="150"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
    </div>
  );
};

export default MacDock;