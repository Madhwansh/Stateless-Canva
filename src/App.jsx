import React from 'react';
import AppRoutes from './routes/AppRoutes.jsx';

/**
 * The root component renders the application routes. Splitting routing
 * configuration into a separate file keeps the App component concise.
 */
export default function App() {
  return <AppRoutes />;
}