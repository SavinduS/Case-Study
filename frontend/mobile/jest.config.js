module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/api/**/*.ts',
    'src/services/**/*.ts',
    'src/components/**/*.tsx',
    'src/screens/**/*.tsx',
    'src/config.ts',
    'src/constants/**/*.ts'
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}']
};
