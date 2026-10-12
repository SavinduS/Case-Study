import { defineConfig } from 'vitest/config';

// The app's logic is plain TypeScript, so it runs in a node environment — no
// React Native runtime needed. Scoped to the pure-logic areas: auth/session,
// constants, utils and the api client (all RN-free or stubbed in the tests).
// The older src/__tests__/validateFieldIncident.test.ts is a node:test file
// written for `node --test` and is not collected here.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/auth/**/*.test.ts',
      'src/constants/**/*.test.ts',
      'src/utils/**/*.test.ts',
      'src/api/**/*.test.ts'
    ]
  }
});