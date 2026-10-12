import { defineConfig } from 'vitest/config';

// The sign-in routing is plain TypeScript, so it runs in a node environment —
// no React Native runtime needed. Scoped to src/auth: the older
// src/__tests__/validateFieldIncident.test.ts is a node:test file written for
// `node --test` and is not collected here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/auth/**/*.test.ts']
  }
});