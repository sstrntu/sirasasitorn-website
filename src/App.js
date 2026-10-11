import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import SceneManager from './components/SceneManager';
import { trackPageView } from './services/analytics';

// Only the home scene ships in the main bundle. The desktop (with Leaflet maps)
// is prefetched at idle priority since most visitors end up there; the admin
// pages (Supabase client) load only when visited.
const MacDesktop = lazy(() => import(/* webpackPrefetch: true */ './components/MacDesktop'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

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
                <Suspense fallback={<div className="route-fallback" />}>
                    <Routes>
                        <Route path="/" element={<SceneManager />} />
                        <Route path="/pro" element={<MacDesktop />} />
                        <Route path="/admin" element={<AdminLogin />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    </Routes>
                </Suspense>
            </Router>
        </div>
    );
}

export default App;