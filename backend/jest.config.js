/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts', // ponto de entrada
    '!src/config.ts',
    '!src/infra/**', // camada Prisma: coberta pelos testes de integração com PostgreSQL
  ],
  // Meta de referência dos documentos (70% das regras de negócio no backend)
  coverageThreshold: { global: { lines: 70, statements: 70, functions: 70, branches: 60 } },
};
