module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@kentslsc/database$': '<rootDir>/../../../packages/database/src/index.ts',
    '^@kentslsc/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^nanoid$': '<rootDir>/../test/mocks/nanoid.mock.ts',
    '^\\./helpers/card-generator\\.js$': '<rootDir>/../test/mocks/card-generator.mock.ts',
    '^(.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|@kentslsc)/)'
  ]
};
