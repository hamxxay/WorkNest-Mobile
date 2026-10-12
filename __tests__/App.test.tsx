/**
 * @format
 *
 * Renders App with its providers (theme, toasts, confirm dialog). Needs the React Native Jest preset
 * (@react-native/jest-preset); jest.config.js skips this file when the preset is not installed.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve('dark')),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-redux', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/store/store', () => ({
  store: {},
}));

jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// The navigators (customer and staff) are not under test here; show the theme mode instead.
jest.mock('../src/navigation/RootNavigator', () => {
  const ReactMock = require('react');
  const { Text } = require('react-native');
  const { useThemeMode } = require('../src/theme');
  return function MockRootNavigator() {
    const { mode, isDark } = useThemeMode();
    return ReactMock.createElement(Text, { testID: 'root' }, `${mode}:${isDark}`);
  };
});

import App from '../App';

test('renders with providers and restores the saved appearance', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer!.root.findByProps({ testID: 'root' }).props.children).toBe('dark:true');
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});
