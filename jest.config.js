/** Jest config for "Log Field Incident Offline" (Member 3 - Mandinu R P S).
 * Run with: npx jest --coverage
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/frontend/mobile'],
  testMatch: ['**/__jest__/**/*.test.[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }],
          ['@babel/preset-typescript', { isTSX: true, allExtensions: true }]
        ]
      }
    ]
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/frontend/mobile/node_modules/react',
    '^react-test-renderer$': '<rootDir>/node_modules/react-test-renderer',
    '^react-native$': '<rootDir>/frontend/mobile/jest/reactNativeMock.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/frontend/mobile/jest/asyncStorageMock.js',
    '^expo-location$': '<rootDir>/frontend/mobile/jest/expoLocationMock.js',
    '^expo-constants$': '<rootDir>/frontend/mobile/jest/expoConstantsMock.js',
    '^expo-file-system$': '<rootDir>/frontend/mobile/jest/expoFileSystemMock.js',
    '^expo-image-picker$': '<rootDir>/frontend/mobile/jest/expoImagePickerMock.js',
    '^react-native-safe-area-context$': '<rootDir>/frontend/mobile/jest/safeAreaMock.js',
    '^@expo/vector-icons$': '<rootDir>/frontend/mobile/jest/vectorIconsMock.js',
    '^@react-native-community/netinfo$': '<rootDir>/frontend/mobile/jest/netInfoMock.js',
    '^(.*)\\.ts$': '$1'
  },
  transformIgnorePatterns: ['node_modules/(?!(@react-native|react-native)/)'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/validateFieldIncident.test.ts'],
  collectCoverage: false,
  collectCoverageFrom: [
    'frontend/mobile/src/services/validateFieldIncident.ts',
    'frontend/mobile/src/services/incidentStorage.ts',
    'frontend/mobile/src/services/syncService.ts',
    'frontend/mobile/src/services/location.ts',
    'frontend/mobile/src/services/offlineQueue.ts',
    'frontend/mobile/src/services/sectors.ts',
    'frontend/mobile/src/hooks/**/*.ts',
    'frontend/mobile/src/screens/NewFieldIncidentScreen.tsx',
    'frontend/mobile/src/screens/ReviewIncidentScreen.tsx',
    'frontend/mobile/src/screens/SubmitResultScreen.tsx',
    'frontend/mobile/src/screens/MyIncidentsScreen.tsx',
    'frontend/mobile/src/components/DescriptionInput.tsx',
    'frontend/mobile/src/components/FieldIncidentTypePicker.tsx',
    'frontend/mobile/src/components/LocationCard.tsx',
    'frontend/mobile/src/components/PrimaryButton.tsx',
    'frontend/mobile/src/components/StatusBanner.tsx',
    'frontend/mobile/src/components/OfflineBadge.tsx',
    'frontend/mobile/src/components/RangerIcon.tsx',
    'frontend/mobile/src/components/RangerSidebar.tsx',
    'frontend/mobile/src/components/StatTile.tsx',
    'frontend/mobile/src/components/StatusChip.tsx',
    'frontend/mobile/src/constants/fieldIncident.ts',
    '!**/__tests__/**',
    '!**/__jest__/**',
    '!**/*.test.*'
  ],
  coverageDirectory: '<rootDir>/coverage/field-incident',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  },
  setupFilesAfterEnv: [],
  testTimeout: 15000
};
