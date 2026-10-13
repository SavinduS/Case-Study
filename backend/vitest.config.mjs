import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Every suite in this scope shares one dedicated test database (see
    // tests/helpers/db.js). Running files in parallel would have them truncating
    // each other's collections, so they run sequentially in one process.
    fileParallelism: false,
    // Scoped so Vitest does not claim the Jest suites in tests/*.test.js.
    // The Member 2 analytics suites live here so they are measured by this
    // runner; the Jest suites still run them independently.
    include: ['tests/collar-alerts/**/*.test.js', 'tests/analytics/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // The collar-alerts suites are the Member 4 use case; the analytics
      // suites are Member 2. Both are measured here against the 80% brief.
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
        'controllers/telemetryController.js',
        // Park Management and Patrol Analytics Reports (Member 2)
        'services/analyticsService.js',
        'controllers/analyticsController.js',
        'config/areas.js',
        'models/AnalyticsReport.js',
        'models/PatrolRecord.js'
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