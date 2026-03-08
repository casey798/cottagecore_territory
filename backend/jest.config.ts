import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'shared/**/*.ts',
    'functions/**/*.ts',
    '!**/*.d.ts',
  ],
};

export default config;
