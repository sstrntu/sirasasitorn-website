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

/** Title and description per page (search results and shared links). */
const PAGE_META = {
    '/': {
        title: 'Sira Sasitorn — AI & Data Engineering',
        description: "Sira Sasitorn's island camp: a little 3D world where Sira lives, with his work on the laptop. AI, data engineering and applied AI.",
    },
    '/pro': {
        title: 'Sira Sasitorn — Résumé & Projects',
        description: "Résumé, projects and experience of Sira Sasitorn, AI & Data Engineering Lead and Managing Director: data engineering, analytics and applied AI.",
    },
};

// Component to track page views on route changes (and set each page's title and description)
function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        const meta = PAGE_META[location.pathname];
        if (meta) {
            document.title = meta.title;
            document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
        }
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