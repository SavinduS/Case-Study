/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/services/**/*.js',
        'src/features/collar-alerts/domain/**/*.js',
        'src/features/collar-alerts/components/**/*.jsx',
        'src/features/collar-alerts/hooks/**/*.js',
        'src/features/collar-alerts/pages/**/*.jsx',
        'src/components/ui/**/*.jsx',
        'src/layout/**/*.jsx'
      ],
      // The Leaflet map is exercised by a separate browser test; excluding it
      // keeps the unit coverage figure meaningful.
      exclude: ['src/features/collar-alerts/components/map/DashboardMap.jsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  }
});