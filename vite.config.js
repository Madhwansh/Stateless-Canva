import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration with the React plugin. This enables JSX
// transformation and fast refresh during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});