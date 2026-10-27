/**
 * The dashboards' quiet auto refresh (CEO and Sales Manager): every 5 minutes while the dashboard is focused and the
 * app is in the foreground; on return (to the screen or the app) at once when the figures are older than 5 minutes;
 * never while paused (a load running, the range editor open), and it runs as soon as the pause ends. React Native's
 * AppState and React Navigation's focus are mocked so this runs in plain Node with fake timers.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

type AppStateListener = (state: string) => void;
const mockAppState: { currentState: string; listeners: AppStateListener[] } = { currentState: "active", listeners: [] };
jest.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_type: string, listener: AppStateListener) => {
      mockAppState.listeners.push(listener);
      return { remove: () => (mockAppState.listeners = mockAppState.listeners.filter((l) => l !== listener)) };
    },
  },
}));
let mockFocused = true;
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../../services/ceo", () => jest.requireActual("../../../services/ceo/refresh"));

import { useAutoRefresh, type AutoRefreshOptions } from "./useAutoRefresh";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const MIN = 60 * 1000;
const START = new Date(2026, 9, 19, 10, 0, 0).getTime();

let lastNow = 0;
function Probe(props: AutoRefreshOptions) {
  lastNow = useAutoRefresh(props);
  return null;
}

function mount(props: Partial<AutoRefreshOptions> = {}) {
  const run = jest.fn();
  const base: AutoRefreshOptions = { run, loadedAt: START, paused: false, ...props };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Probe {...base} />);
  });
  const update = (next: Partial<AutoRefreshOptions>) =>
    act(() => {
      Object.assign(base, next);
      renderer!.update(<Probe {...base} />);
    });
  return { run, update, unmount: () => act(() => renderer!.unmount()) };
}

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const setAppState = (state: string) =>
  act(() => {
    mockAppState.currentState = state;
    mockAppState.listeners.forEach((l) => l(state));
  });

beforeEach(() => {
  jest.useFakeTimers({ now: START });
  mockFocused = true;
  mockAppState.currentState = "active";
  mockAppState.listeners = [];
});

afterEach(() => {
  jest.useRealTimers();
});

test("reloads quietly every 5 minutes on screen, not before", () => {
  const { run, update, unmount } = mount();
  advance(4 * MIN + 30 * 1000);
  expect(run).not.toHaveBeenCalled();
  advance(30 * 1000);
  expect(run).toHaveBeenCalledTimes(1);
  // The new figures arrived: the clock starts again from them.
  update({ loadedAt: Date.now() });
  advance(4 * MIN);
  expect(run).toHaveBeenCalledTimes(1);
  advance(MIN);
  expect(run).toHaveBeenCalledTimes(2);
  unmount();
});

test("a failing server is asked again only after the next interval", () => {
  const { run, unmount } = mount();
  advance(5 * MIN);
  expect(run).toHaveBeenCalledTimes(1);
  // loadedAt never moves (every reload fails).
  advance(4 * MIN);
  expect(run).toHaveBeenCalledTimes(1);
  advance(MIN);
  expect(run).toHaveBeenCalledTimes(2);
  unmount();
});

test("the 'now' it returns moves on every 30 seconds (Updated x ago)", () => {
  const { unmount } = mount();
  const first = lastNow;
  advance(30 * 1000);
  expect(lastNow - first).toBe(30 * 1000);
  unmount();
});

test("not while a drill-down screen is on top; back with stale figures: at once", () => {
  const { run, update, unmount } = mount();
  mockFocused = false;
  update({});
  advance(20 * MIN);
  expect(run).not.toHaveBeenCalled();
  mockFocused = true;
  update({});
  expect(run).toHaveBeenCalledTimes(1);
  unmount();
});

test("back on the screen before 5 minutes: nothing yet", () => {
  const { run, update, unmount } = mount();
  mockFocused = false;
  update({});
  advance(2 * MIN);
  mockFocused = true;
  update({});
  expect(run).not.toHaveBeenCalled();
  advance(3 * MIN);
  expect(run).toHaveBeenCalledTimes(1);
  unmount();
});

test("not while the app is in the background; back in the foreground with stale figures: at once", () => {
  const { run, unmount } = mount();
  setAppState("background");
  advance(30 * MIN);
  expect(run).not.toHaveBeenCalled();
  setAppState("active");
  expect(run).toHaveBeenCalledTimes(1);
  unmount();
});

test("waits while paused (the range editor is open, a load runs) and runs when the pause ends", () => {
  const { run, update, unmount } = mount({ paused: true });
  advance(10 * MIN);
  expect(run).not.toHaveBeenCalled();
  update({ paused: false });
  expect(run).toHaveBeenCalledTimes(1);
  unmount();
});

test("stops when the screen goes away", () => {
  const { run, unmount } = mount();
  unmount();
  advance(30 * MIN);
  expect(run).not.toHaveBeenCalled();
  expect(mockAppState.listeners).toHaveLength(0);
});
