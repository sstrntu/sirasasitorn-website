import React, { useState, useEffect } from 'react';

function NotesManager() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    section_key: '',
    title: '',
    description: '',
    skills_header: '',
    skills_items: [],
    order_index: 0
  });
  const [skillsItemsText, setSkillsItemsText] = useState('[]');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
      const token = session.access_token;

      if (!token) {
        console.warn('No auth token, redirecting to login');
        window.location.href = '/admin';
        return;
      }

      const response = await fetch('/api/admin/notes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_session');
        window.location.href = '/admin';
        return;
      }

      const data = await response.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate and parse skills_items JSON before submitting
    try {
      const parsedSkillsItems = JSON.parse(skillsItemsText);
      if (!Array.isArray(parsedSkillsItems)) {
        alert('Skills Items must be a JSON array');
        return;
      }
    } catch (err) {
      alert('Invalid JSON in Skills Items. Please check the format.');
      return;
    }
    
    try {
      const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
      const token = session.access_token;

      if (!token) {
        alert('Session expired. Please login again.');
        window.location.href = '/admin';
        return;
      }

      const url = editingId 
        ? `/api/admin/notes/${editingId}`
        : '/api/admin/notes';
      
      const method = editingId ? 'PUT' : 'POST';

      // Parse skills_items from text before sending
      const dataToSend = {
        ...formData,
        skills_items: JSON.parse(skillsItemsText)
      };

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('admin_session');
        window.location.href = '/admin';
        return;
      }

      if (response.ok) {
        await fetchNotes();
        resetForm();
        alert(editingId ? 'Note updated!' : 'Note created!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to save note'}`);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  };

  const handleEdit = (note) => {
    setEditingId(note.id);
    setFormData({
      section_key: note.section_key || '',
      title: note.title || '',
      description: note.description || '',
      skills_header: note.skills_header || '',
      skills_items: note.skills_items || [],
      order_index: note.order_index || 0
    });
    setSkillsItemsText(JSON.stringify(note.skills_items || [], null, 2));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note section?')) return;

    try {
      const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
      const token = session.access_token;

      if (!token) {
        alert('Session expired. Please login again.');
        window.location.href = '/admin';
        return;
      }

      const response = await fetch(`/api/admin/notes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('admin_session');
        window.location.href = '/admin';
        return;
      }

      if (response.ok) {
        await fetchNotes();
        alert('Note deleted!');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ 
      section_key: '',
      title: '', 
      description: '', 
      skills_header: '',
      skills_items: [],
      order_index: 0 
    });
    setSkillsItemsText('[]');
  };

  if (loading) {
    return <div className="admin-loading">Loading notes...</div>;
  }

  return (
    <div className="admin-manager">
      <div className="manager-header">
        <h2>📝 Notes Manager</h2>
        <p>Manage notes sections displayed in the NotesApp</p>
      </div>

      {/* Form */}
      <div className="admin-form-card">
        <h3>{editingId ? 'Edit Note' : 'Add New Note'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Section Key</label>
              <input
                type="text"
                value={formData.section_key}
                onChange={(e) => setFormData({...formData, section_key: e.target.value})}
                placeholder="about-me"
                required
                disabled={!!editingId}
              />
              <small>Unique identifier (cannot be changed after creation)</small>
            </div>
            <div className="form-group" style={{width: '150px'}}>
              <label>Order</label>
              <input
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData({...formData, order_index: parseInt(e.target.value)})}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="About me"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Enter description..."
              rows="4"
              required
            />
          </div>

          <div className="form-group">
            <label>Skills Header</label>
            <input
              type="text"
              value={formData.skills_header}
              onChange={(e) => setFormData({...formData, skills_header: e.target.value})}
              placeholder="Skills"
              required
            />
          </div>

          <div className="form-group">
            <label>Skills Items (JSON array)</label>
            <textarea
              value={skillsItemsText}
              onChange={(e) => setSkillsItemsText(e.target.value)}
              placeholder='["React", "Node.js", "Python"]'
              rows="6"
              required
            />
            <small>Enter as JSON array: ["skill1", "skill2"]</small>
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
        <h3>Existing Notes ({notes.length})</h3>
        {notes.length === 0 ? (
          <p className="empty-state">No notes yet. Create your first one above!</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Section Key</th>
                  <th>Title</th>
                  <th>Description Preview</th>
                  <th>Skills</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(note => (
                  <tr key={note.id}>
                    <td>{note.order_index || 0}</td>
                    <td><code>{note.section_key || 'N/A'}</code></td>
                    <td><strong>{note.title || 'Untitled'}</strong></td>
                    <td className="content-preview">
                      {note.description ? note.description.substring(0, 80) + '...' : 'No description'}
                    </td>
                    <td>
                      {note.skills_items && Array.isArray(note.skills_items) 
                        ? `${note.skills_items.length} items` 
                        : '0 items'}
                    </td>
                    <td className="actions">
                      <button onClick={() => handleEdit(note)} className="btn-edit">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(note.id)} className="btn-delete">
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

export default NotesManager;
