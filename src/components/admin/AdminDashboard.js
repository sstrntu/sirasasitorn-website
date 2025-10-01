import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../services/supabaseClient';
import NotesManager from './NotesManager';
import MapsManager from './MapsManager';
import KnowledgeManager from './KnowledgeManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import './AdminStyles.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notes');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if Supabase is configured
      if (!supabase) {
        console.warn('Supabase not configured');
        setLoading(false);
        return;
      }

      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser(session.user);
      } else {
        // Check localStorage fallback
        const storedSession = localStorage.getItem('admin_session');
        if (storedSession) {
          const session = JSON.parse(storedSession);
          setUser(session.user);
        } else {
          navigate('/admin');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('admin_session');
      navigate('/admin');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>📊 CMS Dashboard</h1>
          <p className="admin-user-info">
            {user?.email || 'Admin User'}
          </p>
        </div>
        <div className="admin-header-right">
          <button onClick={() => navigate('/')} className="admin-btn-secondary">
            🏠 View Site
          </button>
          <button onClick={handleLogout} className="admin-btn-logout">
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        <button
          className={`admin-nav-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📝 Notes
        </button>
        <button
          className={`admin-nav-btn ${activeTab === 'maps' ? 'active' : ''}`}
          onClick={() => setActiveTab('maps')}
        >
          📍 Locations
        </button>
        <button
          className={`admin-nav-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          🧠 Knowledge Base
        </button>
        <button
          className={`admin-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
      </nav>

      {/* Content */}
      <main className="admin-content">
        {activeTab === 'notes' && <NotesManager />}
        {activeTab === 'maps' && <MapsManager />}
        {activeTab === 'knowledge' && <KnowledgeManager />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </main>
    </div>
  );
}

export default AdminDashboard;
