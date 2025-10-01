import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from './authHelper';

function KnowledgeManager() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    is_active: true
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/knowledge');
      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingId 
        ? `/api/admin/knowledge/${editingId}`
        : '/api/admin/knowledge';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchDocuments();
        resetForm();
        alert(editingId ? 'Document updated! Embeddings will be regenerated.' : 'Document created! Embeddings generated.');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document');
    }
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setFormData({
      title: doc.title || '',
      content: doc.content || '',
      category: doc.category || '',
      is_active: doc.is_active !== undefined ? doc.is_active : true
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this knowledge base document? This will affect RAG responses.')) return;

    try {
      const response = await authenticatedFetch(`/api/admin/knowledge/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchDocuments();
        alert('Document deleted!');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', category: '', is_active: true });
  };

  if (loading) {
    return <div className="admin-loading">Loading knowledge base...</div>;
  }

  return (
    <div className="admin-manager">
      <div className="manager-header">
        <h2>🧠 Knowledge Base Manager</h2>
        <p>Manage documents used for RAG (Retrieval-Augmented Generation) in AI chat</p>
      </div>

      {/* Info Card */}
      <div className="info-card">
        <h4>ℹ️ How it Works</h4>
        <p>
          Documents added here are converted to vector embeddings and used to enhance AI chat responses. 
          When users ask questions, the AI retrieves relevant information from these documents.
        </p>
        <ul>
          <li>✅ Keep content factual and concise</li>
          <li>✅ Use clear, descriptive titles</li>
          <li>✅ Embeddings are auto-generated on save</li>
        </ul>
      </div>

      {/* Form */}
      <div className="admin-form-card">
        <h3>{editingId ? 'Edit Document' : 'Add New Document'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Technical Skills"
                required
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                placeholder="Skills, Experience, etc."
                required
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
            <label>Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              placeholder="Enter knowledge base content..."
              rows="12"
              required
            />
            <small>This content will be used by AI to answer questions about your portfolio</small>
          </div>

          <div className="form-actions">
            <button type="submit" className="admin-btn-primary">
              {editingId ? '💾 Update & Regenerate Embeddings' : '➕ Create & Generate Embeddings'}
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
        <h3>Knowledge Base Documents ({documents.length})</h3>
        {documents.length === 0 ? (
          <p className="empty-state">No documents yet. Add your first knowledge base entry above!</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Content Preview</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td><strong>{doc.title || 'Untitled'}</strong></td>
                    <td>{doc.category || '-'}</td>
                    <td className="content-preview">
                      {doc.content ? doc.content.substring(0, 100) + '...' : 'No content'}
                    </td>
                    <td>{doc.is_active !== false ? '✅' : '❌'}</td>
                    <td className="actions">
                      <button onClick={() => handleEdit(doc)} className="btn-edit">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="btn-delete">
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

export default KnowledgeManager;
