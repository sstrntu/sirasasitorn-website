import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapsApp.css';
import locations from '../data/locations';
import { geocodeLocation } from '../services/geocoding';

// Fix for default markers in React-Leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapsApp = () => {
  const [pins, setPins] = useState([]);

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

  return (
    <div className="maps-app">
      <div className="maps-content">
        <div className="world-map-container">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            className="leaflet-map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {pins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.coordinates.lat, pin.coordinates.lng]}
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