/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.(t|j)s', '!main.ts'],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    // Floor mirrors the real Session-0 baseline. The global gate exists so a
    // regression that removes an existing test fails CI; the per-file gate
    // locks the WebSocket gateway above its current surface because Session 0
    // makes the WS layer PFLICHT.
    global: { branches: 2, functions: 0, lines: 1, statements: 1 },
    'src/websocket/websocket.gateway.ts': {
      branches: 60,
      functions: 40,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};
