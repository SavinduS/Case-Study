import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Scoped so Vitest does not claim the Jest suites in tests/*.test.js.
    include: ['tests/collar-alerts/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Scoped to the Collar Boundary Alerts code only. The other use cases in
      // this repo are covered by their own runners (see backend/package.json).
      include: [
        'utils/geo.js',
        'utils/collarAlertConstants.js',
        'services/geofenceService.js',
        'services/alertService.js',
        'services/telemetrySimulator.js',
        'controllers/alertController.js',
        'controllers/auditController.js',
        'controllers/collarController.js',
        'controllers/geofenceController.js',
        'controllers/telemetryController.js'
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