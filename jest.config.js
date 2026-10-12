// React Native 0.86 moved the Jest preset to the separate package @react-native/jest-preset.
// When it is installed, it is used as is. Until then (it is not in package.json yet), the plain TypeScript
// unit tests (services, utils, config) run in Node with a small react-native stub; tests that render
// components (__tests__/App.test.tsx) need the real preset and are skipped.
function hasPackage(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

module.exports = hasPackage('@react-native/jest-preset')
  ? { preset: '@react-native/jest-preset' }
  : {
      testEnvironment: 'node',
      globals: { __DEV__: true },
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-firebase)/)',
      ],
      moduleNameMapper: { '^react-native$': '<rootDir>/jest/react-native-stub.js' },
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/App.test.tsx'],
    };
