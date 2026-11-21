import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to :5173. Vite forwards API traffic
// to Express without exposing a second origin to the frontend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
      '/health': { target: 'http://localhost:5000', changeOrigin: false }
    }
  }
});
