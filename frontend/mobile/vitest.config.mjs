import { configDefaults, defineConfig } from 'vitest/config';

// The app's logic is plain TypeScript, so it runs in a node environment — no
// React Native runtime needed. My suites live in src/__tests__ alongside the
// team's; src/__tests__/validateFieldIncident.test.ts is a node:test file
// written for `node --test` and is excluded. The team's sign-in routing tests
// stay under src/auth.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/auth/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/__tests__/validateFieldIncident.test.ts']
  }
});