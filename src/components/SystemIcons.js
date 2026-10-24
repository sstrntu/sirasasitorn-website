import React, { useId } from 'react';

/*
 * Small monochrome icons for the desktop's menu bar and Spotlight, drawn in
 * the text color (24x24 grid, filled like the Mac's menu bar symbols).
 */

const Svg = ({ size = 16, children, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...props}>
    {children}
  </svg>
);

/** The menu bar's "logo": a palm tree, for the island. */
export const PalmIcon = (props) => (
  <Svg {...props}>
    <path d="M11.4 22c.2-4.6.1-9 1.3-13.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M12.8 8.4C9.6 5.6 5.6 5.6 2.2 9.4c3.7-1.4 7.1-1.5 10.6-1z" />
    <path d="M12.8 8.4c3.2-2.8 7.2-2.8 10.6 1-3.7-1.4-7.1-1.5-10.6-1z" />
    <path d="M12.8 8.4C11.6 4.6 8.8 2.4 5.2 2.6c3.2 1.2 5.6 3.2 7.6 5.8z" />
    <path d="M12.8 8.4c1.2-3.8 4-6 7.6-5.8-3.2 1.2-5.6 3.2-7.6 5.8z" />
    <path d="M12.8 8.4c-3.1.4-5.8 2.4-7.1 6 1.9-2.5 4.3-4.3 7.1-6z" />
    <path d="M12.8 8.4c3.1.4 5.8 2.4 7.1 6-1.9-2.5-4.3-4.3-7.1-6z" />
    <circle cx="12.4" cy="9.4" r="1.25" />
  </Svg>
);

export const SearchIcon = (props) => (
  <Svg {...props}>
    <circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M15.3 15.3l5.2 5.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </Svg>
);

/** A cloud (circles over a flat-bottomed bar), raised by `lift`. */
const Cloud = ({ lift = 0, small = false }) => {
  const y = -lift;
  if (small) {
    return (
      <g transform={`translate(0 ${y})`}>
        <circle cx="6.6" cy="15.4" r="3.3" />
        <circle cx="11" cy="12.6" r="4.4" />
        <circle cx="15" cy="15.6" r="3.1" />
        <rect x="6.6" y="15.4" width="8.4" height="3.3" />
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${y})`}>
      <circle cx="7.5" cy="14" r="3.8" />
      <circle cx="12.5" cy="11" r="5" />
      <circle cx="17" cy="14.3" r="3.5" />
      <rect x="7.5" y="14" width="9.5" height="3.8" />
    </g>
  );
};

const Rays = ({ cx, cy, inner, outer, width = 1.8 }) => (
  <g stroke="currentColor" strokeWidth={width} strokeLinecap="round">
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
      const a = (angle * Math.PI) / 180;
      return (
        <line
          key={angle}
          x1={cx + Math.cos(a) * inner}
          y1={cy + Math.sin(a) * inner}
          x2={cx + Math.cos(a) * outer}
          y2={cy + Math.sin(a) * outer}
        />
      );
    })}
  </g>
);

/** A crescent moon: a disc with an offset disc cut out of it. */
const Moon = ({ id, cx, cy, r }) => (
  <>
    <mask id={id}>
      <rect width="24" height="24" fill="white" />
      <circle cx={cx + r * 0.55} cy={cy - r * 0.45} r={r * 0.82} fill="black" />
    </mask>
    <circle cx={cx} cy={cy} r={r} mask={`url(#${id})`} />
  </>
);

/** Something peeking out behind a small cloud, with a gap around the cloud's edge. */
const BehindCloud = ({ id, children }) => (
  <>
    <mask id={id}>
      <rect width="24" height="24" fill="white" />
      <g fill="black" stroke="black" strokeWidth="3">
        <Cloud small />
      </g>
    </mask>
    <g mask={`url(#${id})`}>{children}</g>
    <Cloud small />
  </>
);

/** The current weather's symbol (`weather` from services/weather.js describeWeather). */
export const WeatherIcon = ({ weather, ...props }) => {
  const id = useId().replace(/:/g, '');
  const kind = weather?.kind || 'clear';
  const night = weather ? !weather.isDay : false;

  let shape;
  if (kind === 'clear') {
    shape = night ? (
      <Moon id={`${id}m`} cx={11} cy={13} r={7.5} />
    ) : (
      <>
        <circle cx="12" cy="12" r="4.4" />
        <Rays cx={12} cy={12} inner={7} outer={9.6} width={2} />
      </>
    );
  } else if (kind === 'cloudy') {
    shape = (
      <BehindCloud id={`${id}c`}>
        {night ? (
          <Moon id={`${id}m`} cx={15.5} cy={8.5} r={5} />
        ) : (
          <>
            <circle cx="15.5" cy="8.5" r="3.3" />
            <Rays cx={15.5} cy={8.5} inner={5.2} outer={7.2} width={1.6} />
          </>
        )}
      </BehindCloud>
    );
  } else if (kind === 'overcast') {
    shape = <Cloud lift={1.5} />;
  } else if (kind === 'fog') {
    shape = (
      <>
        <Cloud lift={4} />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="5" y1="17.2" x2="19" y2="17.2" />
          <line x1="7.5" y1="20.6" x2="16.5" y2="20.6" />
        </g>
      </>
    );
  } else if (kind === 'drizzle') {
    shape = (
      <>
        <Cloud lift={4} />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="8.4" y1="16.6" x2="8" y2="18" />
          <line x1="12.4" y1="18.2" x2="12" y2="19.6" />
          <line x1="16.4" y1="16.6" x2="16" y2="18" />
        </g>
      </>
    );
  } else if (kind === 'storm') {
    shape = (
      <>
        <Cloud lift={4} />
        <path d="M12.6 14.6l-3 4.6h2.6l-1.2 3.6 4.4-5.6h-2.7l1.6-2.6z" />
      </>
    );
  } else {
    shape = (
      <>
        <Cloud lift={4} />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="8.6" y1="16.4" x2="7.4" y2="20.2" />
          <line x1="12.6" y1="16.4" x2="11.4" y2="20.2" />
          <line x1="16.6" y1="16.4" x2="15.4" y2="20.2" />
        </g>
      </>
    );
  }
  return <Svg {...props}>{shape}</Svg>;
};

/** An emoji for the weather (Spotlight, the terminal). */
export const weatherEmoji = (weather) => {
  if (!weather) return '🌤️';
  const night = !weather.isDay;
  switch (weather.kind) {
    case 'clear': return night ? '🌙' : '☀️';
    case 'cloudy': return night ? '☁️' : '⛅';
    case 'overcast': return '☁️';
    case 'fog': return '🌫️';
    case 'drizzle': return '🌦️';
    case 'storm': return '⛈️';
    default: return '🌧️';
  }
};
