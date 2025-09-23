// Force import all assets to ensure they're included in the build
// This solves the issue where React only bundles referenced assets

// Import all PNG icons and images from src/assets
import background1 from './background1.png';
import icon from './icon.png';
import acssIcon from './acss-icon.png';
import groundwork10Icon from './groundwork10-icon.png';
import turfmappIcon from './turfmapp-icon.png';

// Export them so they get processed by webpack and included in build
export {
  background1,
  icon,
  acssIcon,
  groundwork10Icon,
  turfmappIcon
};