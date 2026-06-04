/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

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
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isLoadingUser: false,
    refreshUser: jest.fn(),
    setUser: jest.fn(),
    clearSession: jest.fn(),
  }),
}));

jest.mock('../src/navigation/AppNavigator', () => {
  const ReactMock = require('react');
  const { Text } = require('react-native');
  return function MockAppNavigator() {
    return ReactMock.createElement(Text, null, 'App Navigator');
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
