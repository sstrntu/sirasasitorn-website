import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapsApp.css';
import locationsData from '../data/locations';
import { geocodeLocation } from '../services/geocoding';

// Custom red pin marker
import L from 'leaflet';

const redPinIcon = L.divIcon({
  html: `
    <div style="
      position: relative;
      width: 20px;
      height: 32px;
    ">
      <div style="
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 12px;
        height: 12px;
        background: #e74c3c;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
      <div style="
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        height: 20px;
        background: #e74c3c;
        box-shadow: 1px 0 2px rgba(0,0,0,0.2);
      "></div>
      <div style="
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        background: #e74c3c;
        border-radius: 50%;
      "></div>
    </div>
  `,
  className: 'custom-red-pin',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [0, -32],
});

const MapsApp = () => {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Detect mobile for different zoom levels
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    const loadPins = async () => {
      setLoading(true);
      try {
        // Try fetching from API first
        // Use empty string for same-origin requests in production, localhost for development
        const apiUrl = process.env.REACT_APP_API_URL !== undefined ? process.env.REACT_APP_API_URL : 'http://localhost:8007';
        const response = await fetch(`${apiUrl}/api/locations`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Use data from API (already has coordinates)
            const pinData = data.map(loc => ({
              id: loc.id,
              city: loc.city,
              country: loc.country,
              coordinates: {
                lat: parseFloat(loc.latitude),
                lng: parseFloat(loc.longitude)
              },
              label: `${loc.city}, ${loc.country}`,
              description: loc.description,
              category: loc.category
            }));
            
            setPins(pinData);
            setLoading(false);
            return; // Success, exit early
          }
        }
      } catch (error) {
        console.warn('Failed to fetch locations from API, using fallback:', error.message);
      }

      // Fallback: Use hardcoded data with geocoding
      const pinData = [];
      for (const location of locationsData) {
        const result = await geocodeLocation(location.city, location.country);
        if (result.success) {
          pinData.push({
            id: `${location.city}-${location.country}`,
            city: location.city,
            country: location.country,
            coordinates: result.coordinates,
            label: `${location.city}, ${location.country}`
          });
        }
      }

      setPins(pinData);
      setLoading(false);
    };

    loadPins();
  }, []);

  // Handle map resize to ensure tiles load properly
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        // Trigger map resize event to refresh tiles
        setTimeout(() => {
          mapRef.current.invalidateSize();
        }, 100);
      }
    };

    // Initial resize after component mounts
    const timer = setTimeout(() => {
      handleResize();
    }, 500);

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    observer.observe(mapContainerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const timer = setTimeout(() => {
      mapRef.current.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [pins.length, isMobile]);

  return (
    <div className="maps-app">
      <div className="maps-content">
        <div className="world-map-container" ref={mapContainerRef}>
          <MapContainer
            center={[20, 0]}
            zoom={isMobile ? 1 : 2}
            style={{
              height: '100%',
              width: '100%',
              minHeight: isMobile ? '240px' : '320px'
            }}
            className="leaflet-map"
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;

              // Invalidate size once the map is created to render tiles
              setTimeout(() => {
                mapInstance.invalidateSize();
              }, 150);
            }}
            whenReady={() => {
              // Ensure map tiles load when ready (e.g., after window resumes)
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.invalidateSize();
                }
              }, 200);
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {pins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.coordinates.lat, pin.coordinates.lng]}
                icon={redPinIcon}
              >
                <Popup>
                  <div className="custom-popup">
                    <strong>{pin.city}</strong>
                    <br />
                    {pin.country}
                    {pin.category && (
                      <>
                        <br />
                        <span style={{fontSize: '0.85em', color: '#666'}}>
                          {pin.category}
                        </span>
                      </>
                    )}
                    {pin.description && (
                      <>
                        <br />
                        <span style={{fontSize: '0.9em', marginTop: '4px', display: 'block'}}>
                          {pin.description}
                        </span>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Pins List */}
        <div className="pins-sidebar">
          <h3>📍 Locations ({pins.length})</h3>
          <div className="pins-list">
            {loading ? (
              <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                Loading locations...
              </div>
            ) : pins.length === 0 ? (
              <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                No locations yet
              </div>
            ) : (
              pins.map((pin) => (
                <div key={pin.id} className="pin-item">
                  <span className="pin-icon">📍</span>
                  <div className="pin-info">
                    <div className="pin-city">{pin.city}</div>
                    <div className="pin-country">{pin.country}</div>
                    {pin.category && (
                      <div className="pin-category" style={{fontSize: '0.85em', color: '#888', marginTop: '2px'}}>
                        {pin.category}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapsApp;
