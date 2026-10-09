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
    // userEvent drives real events through jsdom, so an overloaded machine
    // (dev server running, several suites at once) can push a slow
    // interaction past the 5s default. This is headroom, not a real failure.
    testTimeout: 20_000,
    poolOptions: {
      threads: { maxThreads: 4 }
    },
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