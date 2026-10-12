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
    ]
  }
});