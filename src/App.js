import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SceneManager from './components/SceneManager';
import MacDesktop from './components/MacDesktop';

function App() {
    return (
        <div className="App">
            <Router>
                <Routes>
                    <Route path="/" element={<SceneManager />} />
                    <Route path="/pro" element={<MacDesktop />} />
                </Routes>
            </Router>
        </div>
    );
}

export default App;