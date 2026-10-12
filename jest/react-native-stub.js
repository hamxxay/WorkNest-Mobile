// Minimal react-native for unit tests that run without @react-native/jest-preset (see jest.config.js).
module.exports = {
  Platform: {
    OS: 'android',
    Version: 34,
    select: options => (options.android !== undefined ? options.android : options.default),
  },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
    request: async () => 'granted',
    check: async () => true,
  },
  Linking: {
    openURL: async () => undefined,
    canOpenURL: async () => true,
    getInitialURL: async () => null,
    addEventListener: () => ({ remove: () => undefined }),
  },
  Alert: { alert: () => undefined },
};
