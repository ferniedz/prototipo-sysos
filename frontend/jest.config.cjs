/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: { '^.+\\.tsx?$': '<rootDir>/test/typescript-transformer.cjs' },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/lib/registry.ts',
    'src/lib/api.ts',
    'src/components/SearchPanels.tsx',
    'src/components/Details.tsx',
    'src/components/Forms.tsx',
    'src/components/Modal.tsx',
    'src/App.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
}
