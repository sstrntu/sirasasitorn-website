import React from 'react';
import { trackException } from '../../services/analytics';

/** A short, readable reason for the fallback screen and the error report. */
const describe = (error, forceFallback, fallbackReason) => {
  if (!error && forceFallback) return fallbackReason || 'WebGL is turned off or not supported in this browser.';
  return String(error?.message || error || 'Unknown error').slice(0, 180);
};

/**
 * If WebGL is unavailable or the 3D scene crashes, show a simple fallback that
 * still lets visitors reach the desktop. Given `onCrash`, the first crash is
 * handed to it instead (the scene retries in its lighter safe mode), with
 * nothing drawn in between. The fallback names what went wrong, so a failing
 * device can be diagnosed from a screenshot. `forceFallback` shows it without
 * an error (no WebGL, or the context kept being lost: `fallbackReason`).
 * (Error boundaries must be classes.)
 */
class SceneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Jungle scene failed to render:', error);
    trackException(`3D scene${this.props.onCrash ? '' : ' (safe mode)'}: ${describe(error)}`, !this.props.onCrash);
    if (this.props.onCrash) {
      this.props.onCrash(error);
      return;
    }
    this.props.onError?.();
  }

  render() {
    const { error } = this.state;
    const { forceFallback, fallbackReason, onCrash, onEnter, children } = this.props;
    if (error && onCrash) return null; // retrying in safe mode
    if (error || forceFallback) {
      return (
        <div className="jungle-fallback">
          <p>The 3D camp couldn't load on this device.</p>
          <button type="button" className="jungle-button" onClick={onEnter}>
            Open Sira's computer →
          </button>
          <p className="jungle-fallback-detail">{describe(error, forceFallback, fallbackReason)}</p>
        </div>
      );
    }
    return children;
  }
}

export default SceneErrorBoundary;
