import { rowKey, shouldReloadOnFocus, singleFlight, uniqueBy } from "./guards";

describe("shouldReloadOnFocus", () => {
  const base = { reloadOnFocus: true, loadedAt: 1_000, stale: false, staleAfterMs: 30_000, now: 1_000 };

  it("keeps fresh data; reloads data older than the limit", () => {
    expect(shouldReloadOnFocus({ ...base, now: 1_000 + 29_999 })).toBe(false);
    expect(shouldReloadOnFocus({ ...base, now: 1_000 + 30_000 })).toBe(true);
  });

  it("always reloads after an edit (marked stale) or without a limit", () => {
    expect(shouldReloadOnFocus({ ...base, stale: true })).toBe(true);
    expect(shouldReloadOnFocus({ ...base, staleAfterMs: 0 })).toBe(true);
  });

  it("never before the first load or when focus reloads are off", () => {
    expect(shouldReloadOnFocus({ ...base, loadedAt: null, stale: true })).toBe(false);
    expect(shouldReloadOnFocus({ ...base, reloadOnFocus: false, stale: true })).toBe(false);
  });
});

describe("singleFlight", () => {
  it("ignores calls while one runs, then accepts the next", async () => {
    let release: () => void = () => undefined;
    const action = jest.fn(() => new Promise<string>((resolve) => (release = () => resolve("sent"))));
    const submit = singleFlight(action);

    const first = submit();
    const second = submit(); // keyboard submit right after the button tap
    expect(action).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();
    release();
    await expect(first).resolves.toBe("sent");

    const third = submit();
    expect(action).toHaveBeenCalledTimes(2);
    release();
    await third;
  });

  it("is free again after a failure", async () => {
    const action = jest.fn(async (fail: boolean) => {
      if (fail) throw new Error("offline");
      return "ok";
    });
    const submit = singleFlight(action);
    await expect(submit(true)).rejects.toThrow("offline");
    await expect(submit(false)).resolves.toBe("ok");
  });
});

describe("list keys", () => {
  it("rowKey prefers the id, then the public id, then the position", () => {
    expect(rowKey({ id: 7, publicId: "g" }, 0)).toBe("id:7");
    expect(rowKey({ id: null, publicId: "g" }, 0)).toBe("guid:g");
    expect(rowKey({ id: null, publicId: null }, 3)).toBe("row:3");
  });

  it("uniqueBy drops repeated rows (pages that overlap)", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 1 }, { id: null }, { id: null }];
    expect(uniqueBy(rows, rowKey)).toEqual([{ id: 1 }, { id: 2 }, { id: null }, { id: null }]);
  });
});
