// Simple geocoding service using approximate coordinates for major cities
// For a production app, you would use a real geocoding API like Google Maps or Mapbox

const cityCoordinates = {
  // North America
  "new york,united states": { lat: 40.7128, lng: -74.0060 },
  "los angeles,united states": { lat: 34.0522, lng: -118.2437 },
  "chicago,united states": { lat: 41.8781, lng: -87.6298 },
  "toronto,canada": { lat: 43.6532, lng: -79.3832 },
  "mexico city,mexico": { lat: 19.4326, lng: -99.1332 },

  // Europe
  "london,united kingdom": { lat: 51.5074, lng: -0.1278 },
  "paris,france": { lat: 48.8566, lng: 2.3522 },
  "berlin,germany": { lat: 52.5200, lng: 13.4050 },
  "rome,italy": { lat: 41.9028, lng: 12.4964 },
  "madrid,spain": { lat: 40.4168, lng: -3.7038 },
  "amsterdam,netherlands": { lat: 52.3676, lng: 4.9041 },
  "stockholm,sweden": { lat: 59.3293, lng: 18.0686 },
  "oslo,norway": { lat: 59.9139, lng: 10.7522 },
  "copenhagen,denmark": { lat: 55.6761, lng: 12.5683 },
  "helsinki,finland": { lat: 60.1699, lng: 24.9384 },

  // Asia
  "tokyo,japan": { lat: 35.6762, lng: 139.6503 },
  "seoul,south korea": { lat: 37.5665, lng: 126.9780 },
  "beijing,china": { lat: 39.9042, lng: 116.4074 },
  "shanghai,china": { lat: 31.2304, lng: 121.4737 },
  "mumbai,india": { lat: 19.0760, lng: 72.8777 },
  "delhi,india": { lat: 28.7041, lng: 77.1025 },
  "bangkok,thailand": { lat: 13.7563, lng: 100.5018 },
  "singapore,singapore": { lat: 1.3521, lng: 103.8198 },
  "hong kong,china": { lat: 22.3193, lng: 114.1694 },
  "dubai,united arab emirates": { lat: 25.2048, lng: 55.2708 },

  // Oceania
  "sydney,australia": { lat: -33.8688, lng: 151.2093 },
  "melbourne,australia": { lat: -37.8136, lng: 144.9631 },
  "auckland,new zealand": { lat: -36.8485, lng: 174.7633 },

  // South America
  "rio de janeiro,brazil": { lat: -22.9068, lng: -43.1729 },
  "são paulo,brazil": { lat: -23.5505, lng: -46.6333 },
  "buenos aires,argentina": { lat: -34.6118, lng: -58.3960 },
  "lima,peru": { lat: -12.0464, lng: -77.0428 },
  "bogotá,colombia": { lat: 4.7110, lng: -74.0721 },

  // Africa
  "cairo,egypt": { lat: 30.0444, lng: 31.2357 },
  "cape town,south africa": { lat: -33.9249, lng: 18.4241 },
  "lagos,nigeria": { lat: 6.5244, lng: 3.3792 },
  "nairobi,kenya": { lat: -1.2921, lng: 36.8219 },
  "marrakech,morocco": { lat: 31.6295, lng: -7.9811 }
};

export const geocodeLocation = async (city, country) => {
  const key = `${city.toLowerCase()},${country.toLowerCase()}`;
  const coordinates = cityCoordinates[key];

  if (coordinates) {
    return {
      success: true,
      coordinates,
      location: `${city}, ${country}`
    };
  }

  // If not found in our database, return null
  return {
    success: false,
    error: `Location not found: ${city}, ${country}`,
    location: `${city}, ${country}`
  };
};

export default { geocodeLocation };