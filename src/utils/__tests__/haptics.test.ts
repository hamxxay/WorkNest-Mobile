// The haptics wrapper: maps kinds to the native types, respects the user's switch, and never throws.

type HapticsModule = typeof import("../haptics");

function load(
  options: { engine?: "ok" | "missing" | "throws"; saved?: string | null } = {},
) {
  const trigger = jest.fn();
  const setItem = jest.fn(() => Promise.resolve());
  const getItem = jest.fn(() => Promise.resolve(options.saved ?? null));
  // Fresh registry per load: the wrapper requires the native package lazily, at the first haptic.
  jest.resetModules();
  jest.doMock("react-native-haptic-feedback", () => {
    if (options.engine === "missing")
      throw new Error(
        "TurboModuleRegistry: 'RNHapticFeedback' could not be found",
      );
    return {
      __esModule: true,
      default: {
        trigger:
          options.engine === "throws"
            ? () => {
                throw new Error("boom");
              }
            : trigger,
      },
    };
  });
  jest.doMock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: { getItem, setItem },
  }));
  const mod: HapticsModule = require("../haptics");
  return { mod, trigger, setItem, getItem };
}

const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

describe("haptics", () => {
  let now = 1_000;
  beforeEach(() => {
    now += 10_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps every kind to a react-native-haptic-feedback type", () => {
    const { mod, trigger } = load();
    mod.haptics.success();
    expect(trigger).toHaveBeenCalledWith("notificationSuccess", {
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
    now += 1000;
    mod.haptics.selection();
    expect(trigger).toHaveBeenLastCalledWith("selection", expect.any(Object));
    now += 1000;
    mod.haptics.light();
    expect(trigger).toHaveBeenLastCalledWith("impactLight", expect.any(Object));
    now += 1000;
    mod.haptics.medium();
    expect(trigger).toHaveBeenLastCalledWith(
      "impactMedium",
      expect.any(Object),
    );
    now += 1000;
    mod.haptics.error();
    expect(trigger).toHaveBeenLastCalledWith(
      "notificationError",
      expect.any(Object),
    );
    now += 1000;
    mod.haptics.warning();
    expect(trigger).toHaveBeenLastCalledWith(
      "notificationWarning",
      expect.any(Object),
    );
  });

  it("plays only the first of two haptics in the same gesture", () => {
    const { mod, trigger } = load();
    mod.haptics.light();
    now += 20;
    mod.haptics.selection();
    expect(trigger).toHaveBeenCalledTimes(1);
    now += 100;
    mod.haptics.selection();
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it("always plays an outcome, even right after a tap", () => {
    const { mod, trigger } = load();
    mod.haptics.light();
    now += 5;
    mod.haptics.warning();
    expect(trigger).toHaveBeenCalledTimes(2);
    expect(trigger).toHaveBeenLastCalledWith("notificationWarning", expect.any(Object));
  });

  it("is a no-op when the native module is missing or throws", () => {
    const missing = load({ engine: "missing" });
    expect(() => missing.mod.haptics.success()).not.toThrow();
    const throwing = load({ engine: "throws" });
    expect(() => throwing.mod.haptics.error()).not.toThrow();
  });

  it("stays silent when the user switched haptics off, and saves the choice", () => {
    const { mod, trigger, setItem } = load();
    const listener = jest.fn();
    const unsubscribe = mod.subscribeHaptics(listener);
    mod.setHapticsEnabled(false);
    expect(mod.isHapticsEnabled()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(mod.HAPTICS_STORAGE_KEY, "0");
    mod.haptics.success();
    expect(trigger).not.toHaveBeenCalled();
    unsubscribe();
    mod.setHapticsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    mod.haptics.success();
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("reads the saved preference on import", async () => {
    const { mod, getItem } = load({ saved: "0" });
    await flush();
    expect(getItem).toHaveBeenCalledWith(mod.HAPTICS_STORAGE_KEY);
    expect(mod.isHapticsEnabled()).toBe(false);
  });

  it("keeps a choice made while the saved preference was loading", async () => {
    const { mod } = load({ saved: "0" });
    mod.setHapticsEnabled(true);
    await flush();
    expect(mod.isHapticsEnabled()).toBe(true);
  });
});
