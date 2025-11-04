import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import SceneManager from './components/SceneManager';
import MacDesktop from './components/MacDesktop';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import { trackPageView } from './services/analytics';

// Component to track page views on route changes
function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        trackPageView(location.pathname + location.search);
    }, [location]);

    return null;
}

function App() {
    return (
        <div className="App">
            <Router>
                <AnalyticsTracker />
                <Routes>
                    <Route path="/" element={<SceneManager />} />
                    <Route path="/pro" element={<MacDesktop />} />
                    <Route path="/admin" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                </Routes>
            </Router>
        </div>
    );
}

export default App;