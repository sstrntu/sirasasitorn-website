import { useCallback, useEffect, useRef, useState } from 'react';

// Zoom-out progress (0..1) per unit of input
const PER_SCROLL_PX = 1 / 600; // mouse wheel / two-finger scroll down
const PER_PINCH_PX = 1 / 150; // trackpad pinch in (Chrome, Firefox and Edge report it as ctrl + wheel)
const PER_PINCH_SCALE = 2.2; // touch pinch and Safari's trackpad pinch: per unit of scale lost
/** A zoom-out left part-way settles after this long without input (seconds)... */
const SETTLE_AFTER = 0.45;
/** ...carrying on out from this far, springing back in otherwise. */
const COMMIT_AT = 0.5;
/** How quickly the fade follows the input (exponential damping rate, 1/s). */
const FOLLOW_RATE = 8;

// Scrolling or pinching inside these keeps doing what it does there
const IGNORE = '.draggable-window, input, textarea, select, [contenteditable="true"]';
const onWallpaper = (target) => target instanceof Element && !target.closest(IGNORE);

/** The fade runs on a CSS variable and class, so it needs no React re-renders. */
const paint = (element, progress) => {
  if (!element) return;
  element.style.setProperty('--leave', progress.toFixed(3));
  element.classList.toggle('is-leaving', progress > 0);
};

/**
 * Zoom out of the desktop to go back to the 3D camp: scrolling down or
 * pinching in on the wallpaper (not inside a window) fades the windows, icons
 * and dock away, leaving the wallpaper, which is what the laptop screen in the
 * scene shows. Past halfway it carries on and calls `onLeave`; stopping early
 * or scrolling back brings the desktop back. It's the scene's scroll-to-dive
 * into the laptop, in reverse.
 *
 * Returns a callback ref for the desktop element (its `--leave` CSS variable,
 * 0..1, and `is-leaving` class carry the progress) and `leave()`, which plays
 * the zoom-out through without a gesture.
 */
export const useZoomOutGesture = (onLeave) => {
  const [element, setElement] = useState(null);
  const elementRef = useRef(null);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const state = useRef({ progress: 0, goal: 0, idle: 0, last: 0, raf: 0, done: false });

  // Animate the progress toward the goal; stops once it's back at 0 or has left
  const run = useCallback(() => {
    const s = state.current;
    if (s.raf || s.done) return;
    s.last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 20);
      s.last = now;
      s.idle += dt;
      if (s.goal > 0 && s.goal < 1 && s.idle > SETTLE_AFTER) s.goal = s.goal >= COMMIT_AT ? 1 : 0;
      s.progress += (s.goal - s.progress) * (1 - Math.exp(-FOLLOW_RATE * dt));
      if (Math.abs(s.goal - s.progress) < 0.002) s.progress = s.goal;
      paint(elementRef.current, s.progress);
      s.raf = 0;
      if (s.progress === 1) {
        s.done = true;
        onLeaveRef.current?.();
      } else if (s.progress > 0 || s.goal > 0) {
        s.raf = requestAnimationFrame(tick);
      }
    };
    s.raf = requestAnimationFrame(tick);
  }, []);

  // Positive amount = further out
  const push = useCallback(
    (amount) => {
      const s = state.current;
      if (s.done) return;
      s.goal = Math.min(1, Math.max(0, s.goal + amount));
      s.idle = 0;
      run();
    },
    [run]
  );

  const leave = useCallback(() => push(1), [push]);

  useEffect(() => {
    elementRef.current = element;
    if (!element) return undefined;
    paint(element, state.current.progress);

    // Finger distance of a two-finger pinch on the wallpaper (0 when none)
    let pinch = 0;
    // Last scale of a Safari pinch gesture on the wallpaper (0 when none)
    let gestureScale = 0;

    const onWheel = (e) => {
      if (!onWallpaper(e.target)) return;
      if (e.ctrlKey) {
        // Trackpad pinch: keep the browser from zooming the page instead
        e.preventDefault();
        if (!gestureScale) push(e.deltaY * PER_PINCH_PX);
        return;
      }
      // Normalize line/page scrolling to pixels
      push(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1) * PER_SCROLL_PX);
    };

    const fingerDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      pinch = e.touches.length === 2 && Array.from(e.touches).every((t) => onWallpaper(t.target)) ? fingerDistance(e.touches) : 0;
    };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      const distance = fingerDistance(e.touches);
      push(((pinch - distance) / pinch) * PER_PINCH_SCALE);
      pinch = distance;
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinch = 0;
    };

    // Safari reports trackpad pinches as gesture events (and also sends them
    // for touch pinches on iOS, which the touch handlers above already count)
    const onGestureStart = (e) => {
      if (!onWallpaper(e.target)) return;
      e.preventDefault(); // no page zoom
      gestureScale = 1;
    };
    const onGestureChange = (e) => {
      if (!gestureScale) return;
      e.preventDefault();
      if (!pinch) push((gestureScale - e.scale) * PER_PINCH_SCALE);
      gestureScale = e.scale;
    };
    const onGestureEnd = () => {
      gestureScale = 0;
    };

    const listeners = [
      ['wheel', onWheel, { passive: false }],
      ['touchstart', onTouchStart, { passive: true }],
      ['touchmove', onTouchMove, { passive: true }],
      ['touchend', onTouchEnd, { passive: true }],
      ['touchcancel', onTouchEnd, { passive: true }],
      ['gesturestart', onGestureStart],
      ['gesturechange', onGestureChange],
      ['gestureend', onGestureEnd],
    ];
    listeners.forEach(([type, handler, options]) => element.addEventListener(type, handler, options));
    return () => listeners.forEach(([type, handler, options]) => element.removeEventListener(type, handler, options));
  }, [element, push]);

  useEffect(() => {
    const s = state.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  return { ref: setElement, leave };
};
