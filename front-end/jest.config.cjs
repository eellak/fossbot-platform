module.exports = {
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  resetMocks: true,
  setupFiles: ['<rootDir>/test/setup.cjs'],
  moduleNameMapper: {
    '\\.(css|svg|png|jpe?g|mp[34]|vtt)$': '<rootDir>/test/asset.cjs',
    '^three$': '<rootDir>/node_modules/three',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    }],
  },
};
