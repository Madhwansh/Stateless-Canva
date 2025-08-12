import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen.jsx';
import CanvasScreen from '../screens/CanvasScreen.jsx';

/**
 * Defines all client-side routes. The root path generates a new scene ID and
 * redirects, while `/canvas/:id` loads the drawing surface for that ID.
 */
export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/canvas/:id" element={<CanvasScreen />} />
      </Routes>
    </Router>
  );
}