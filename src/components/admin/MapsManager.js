import React, { useState, useEffect } from 'react';
import { authenticatedFetch, handleAuthError } from './authHelper';

function MapsManager() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    description: '',
    category: '',
    is_active: true
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/locations');
      const data = await response.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingId 
        ? `/api/admin/locations/${editingId}`
        : '/api/admin/locations';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude)
        })
      });

      if (response.ok) {
        await fetchLocations();
        resetForm();
        alert(editingId ? 'Location updated!' : 'Location created!');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    }
  };

  const handleEdit = (location) => {
    setEditingId(location.id);
    setFormData({
      city: location.city || '',
      country: location.country || '',
      latitude: location.latitude?.toString() || '',
      longitude: location.longitude?.toString() || '',
      description: location.description || '',
      category: location.category || '',
      is_active: location.is_active !== undefined ? location.is_active : true
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this location?')) return;

    try {
      const response = await authenticatedFetch(`/api/admin/locations/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchLocations();
        alert('Location deleted!');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      city: '',
      country: '',
      latitude: '',
      longitude: '',
      description: '',
      category: '',
      is_active: true
    });
  };

  if (loading) {
    return <div className="admin-loading">Loading locations...</div>;
  }

  return (
    <div className="admin-manager">
      <div className="manager-header">
        <h2>📍 Locations Manager</h2>
        <p>Manage map locations displayed in the MapsApp</p>
      </div>

      {/* Form */}
      <div className="admin-form-card">
        <h3>{editingId ? 'Edit Location' : 'Add New Location'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="New York"
                required
              />
            </div>
            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
                placeholder="United States"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                placeholder="40.7128"
                required
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                placeholder="-74.0060"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category (optional)</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                placeholder="Visited, Want to visit, etc."
              />
            </div>
            <div className="form-group" style={{width: '150px'}}>
              <label>Active</label>
              <select
                value={formData.is_active ? 'true' : 'false'}
                onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <small>Hidden if inactive</small>
            </div>
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Add notes about this location..."
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="admin-btn-primary">
              {editingId ? '💾 Update' : '➕ Create'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="admin-btn-secondary">
                ❌ Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="admin-list-card">
        <h3>Existing Locations ({locations.length})</h3>
        {locations.length === 0 ? (
          <p className="empty-state">No locations yet. Add your first one above!</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>City</th>
                  <th>Country</th>
                  <th>Coordinates</th>
                  <th>Category</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(location => (
                  <tr key={location.id}>
                    <td><strong>{location.city || 'Unknown'}</strong></td>
                    <td>{location.country || '-'}</td>
                    <td className="coordinates">
                      {location.latitude !== null && location.latitude !== undefined ? location.latitude.toFixed(4) : '0.0000'}, 
                      {location.longitude !== null && location.longitude !== undefined ? location.longitude.toFixed(4) : '0.0000'}
                    </td>
                    <td>{location.category || '-'}</td>
                    <td>{location.is_active !== false ? '✅' : '❌'}</td>
                    <td className="actions">
                      <button onClick={() => handleEdit(location)} className="btn-edit">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(location.id)} className="btn-delete">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapsManager;
