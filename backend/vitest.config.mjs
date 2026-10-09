import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'utils/geo.js',
        'utils/collarAlertConstants.js',
        'services/geofenceService.js',
        'services/alertService.js',
        'services/telemetrySimulator.js',
        'controllers/**/*.js'
      ],
      thresholds: {
        // The brief asks for 80% of functionality covered.
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});