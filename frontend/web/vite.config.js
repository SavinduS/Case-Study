import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keep the browser on one origin so the API needs no CORS setup and no
    // base URL is baked into the bundle. Matches PORT in backend/.env.
    proxy: {
      '/api': { target: 'http://localhost:5055', changeOrigin: true }
    }
  }
});