import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from './authHelper';

function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState([]);
  const [stats, setStats] = useState({
    total_chats: 0,
    unique_users: 0,
    avg_messages_per_chat: 0,
    rag_usage: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/analytics');
      const data = await response.json();
      
      if (data.analytics) {
        setAnalytics(data.analytics);
        calculateStats(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const total = data.length;
    const unique = new Set(data.map(item => item.client_id)).size;
    const avgMessages = total > 0 
      ? (data.reduce((sum, item) => sum + (item.messages?.length || 0), 0) / total).toFixed(1)
      : 0;
    const ragCount = data.filter(item => item.rag_used).length;

    setStats({
      total_chats: total,
      unique_users: unique,
      avg_messages_per_chat: avgMessages,
      rag_usage: ((ragCount / total) * 100).toFixed(1)
    });
  };

  if (loading) {
    return <div className="admin-loading">Loading analytics...</div>;
  }

  return (
    <div className="admin-manager">
      <div className="manager-header">
        <h2>📈 Analytics Dashboard</h2>
        <p>Chat usage and performance metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-value">{stats.total_chats}</div>
          <div className="stat-label">Total Chats</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.unique_users}</div>
          <div className="stat-label">Unique Users</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{stats.avg_messages_per_chat}</div>
          <div className="stat-label">Avg Messages/Chat</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🧠</div>
          <div className="stat-value">{stats.rag_usage}%</div>
          <div className="stat-label">RAG Usage</div>
        </div>
      </div>

      {/* Recent Chats */}
      <div className="admin-list-card">
        <h3>Recent Chat Sessions ({analytics.length})</h3>
        {analytics.length === 0 ? (
          <p className="empty-state">No chat sessions yet. Analytics will appear when users start chatting!</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User ID</th>
                  <th>Messages</th>
                  <th>RAG Used</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {analytics.slice(0, 50).map((item, index) => (
                  <tr key={index}>
                    <td>
                      {new Date(item.created_at).toLocaleDateString()} {' '}
                      {new Date(item.created_at).toLocaleTimeString()}
                    </td>
                    <td className="mono">{item.client_id.substring(0, 8)}...</td>
                    <td>{item.messages?.length || 0}</td>
                    <td>
                      {item.rag_used ? (
                        <span className="badge badge-success">✅ Yes</span>
                      ) : (
                        <span className="badge badge-neutral">⚪ No</span>
                      )}
                    </td>
                    <td>
                      {item.response_time 
                        ? `${(item.response_time / 1000).toFixed(2)}s`
                        : '-'}
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

export default AnalyticsDashboard;
