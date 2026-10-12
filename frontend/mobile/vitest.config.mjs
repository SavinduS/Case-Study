import { defineConfig } from 'vitest/config';

// The app's logic is plain TypeScript, so it runs in a node environment — no
// React Native runtime needed. My suites live in tests/conflict-report-submit-villager
// (mirroring backend/tests/); the team's sign-in routing tests stay under
// src/auth. The older src/__tests__/validateFieldIncident.test.ts is a node:test
// file written for `node --test` and is not collected here.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/conflict-report-submit-villager/**/*.test.ts',
      'src/auth/**/*.test.ts'
    ]
  }
});