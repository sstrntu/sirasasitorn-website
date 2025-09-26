import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapsApp.css';
import locations from '../data/locations';
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
  const mapRef = useRef(null);

  // Detect mobile for different zoom levels
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    const loadPins = async () => {
      const pinData = [];

      for (const location of locations) {
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

  return (
    <div className="maps-app">
      <div className="maps-content">
        <div className="world-map-container">
          <MapContainer
            center={[20, 0]}
            zoom={isMobile ? 1 : 2}
            style={{ height: '100%', width: '100%' }}
            className="leaflet-map"
            ref={mapRef}
            whenReady={() => {
              // Ensure map tiles load when ready
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
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Pins List */}
        <div className="pins-sidebar">
          <h3>📍 Locations</h3>
          <div className="pins-list">
            {pins.map((pin) => (
              <div key={pin.id} className="pin-item">
                <span className="pin-icon">📍</span>
                <div className="pin-info">
                  <div className="pin-city">{pin.city}</div>
                  <div className="pin-country">{pin.country}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapsApp;