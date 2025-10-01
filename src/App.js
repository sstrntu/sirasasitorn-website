import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SceneManager from './components/SceneManager';
import MacDesktop from './components/MacDesktop';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';

function App() {
    return (
        <div className="App">
            <Router>
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