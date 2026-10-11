import React from 'react';

/**
 * If WebGL is unavailable or the 3D scene crashes, show a simple fallback that
 * still lets visitors reach the desktop. (Error boundaries must be classes.)
 */
class SceneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Jungle scene failed to render:', error);
  }

  render() {
    if (this.state.hasError || this.props.forceFallback) {
      return (
        <div className="jungle-fallback">
          <p>The 3D camp couldn't load on this device.</p>
          <button type="button" className="jungle-button" onClick={this.props.onEnter}>
            Open Sira's computer →
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SceneErrorBoundary;
