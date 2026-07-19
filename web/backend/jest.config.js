module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/tests/testUtils/env.js'],
  collectCoverage: false,
  collectCoverageFrom: ['src/validators/**/*.js', 'src/services/**/*.js'],
  coverageProvider: 'v8',
  coverageReporters: ['text', 'html'],
};
