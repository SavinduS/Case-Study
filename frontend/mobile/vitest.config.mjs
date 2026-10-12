import { defineConfig } from 'vitest/config';

// The app's logic is plain TypeScript, so it runs in a node environment — no
// React Native runtime needed. My suites live in
// src/__tests__/conflict-report-submit-villager (mirroring
// backend/tests/conflict-report-submit-villager). The team's sign-in routing
// tests stay under src/auth; the team's validateFieldIncident.test.ts is a
// node:test file and is simply not matched by these includes.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/__tests__/conflict-report-submit-villager/**/*.test.ts',
      'src/auth/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      // Scoped the same way backend/tests/collar-alerts is: only the modules
      // these node-env suites actually cover. UI screens/components need a
      // React Native renderer and are outside this runner's scope.
      include: [
        'src/api/baseUrl.ts',
        'src/api/client.ts',
        'src/auth/registerValidation.ts',
        'src/auth/roles.ts',
        'src/auth/sessionShape.ts',
        'src/config.ts',
        'src/constants/incidentTypes.ts',
        'src/constants/sms.ts',
        'src/utils/time.ts'
      ]
    }
  }
});