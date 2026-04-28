/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  // Tell Jest to ignore ESM modules only if they leak through;
  // with mocks in place, this is just a safety net.
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|groq-sdk)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock the ESM modules so they never load
    '^uuid$': '<rootDir>/__mocks__/uuid.ts',
    '^groq-sdk$': '<rootDir>/__mocks__/groq-sdk.ts',
  },
  roots: ['<rootDir>/__tests__'],
};