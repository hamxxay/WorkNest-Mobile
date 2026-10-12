import { createEntranceTracker, ENTRANCE_MAX_ROWS, ENTRANCE_WINDOW_MS } from "../entrance";

describe("createEntranceTracker", () => {
  it("animates the first rows of the first load, each once", () => {
    const t = createEntranceTracker();
    expect(t.claim("a", 0, 1000)).toBe(true);
    expect(t.claim("b", 1, 1010)).toBe(true);
    // The same row mounted again (cell recycled back into view) does not replay.
    expect(t.claim("a", 0, 1200)).toBe(false);
  });

  it("caps the number of animated rows", () => {
    const t = createEntranceTracker();
    expect(t.claim("first", 0, 1000)).toBe(true);
    expect(t.claim("last", ENTRANCE_MAX_ROWS - 1, 1000)).toBe(true);
    expect(t.claim("beyond", ENTRANCE_MAX_ROWS, 1000)).toBe(false);
    expect(t.claim("negative", -1, 1000)).toBe(false);
  });

  it("stops animating once the first load is over (next pages appear at once)", () => {
    const t = createEntranceTracker();
    expect(t.claim("a", 0, 1000)).toBe(true);
    expect(t.claim("b", 1, 1000 + ENTRANCE_WINDOW_MS + 1)).toBe(false);
  });

  it("animates again after a reset (new search, filter or reload)", () => {
    const t = createEntranceTracker();
    t.claim("a", 0, 1000);
    t.reset();
    expect(t.claim("a", 0, 99_000)).toBe(true);
  });

  it("takes custom limits", () => {
    const t = createEntranceTracker(2, 100);
    expect(t.claim("a", 1, 0 + 5)).toBe(true);
    expect(t.claim("b", 2, 10)).toBe(false);
    expect(t.claim("c", 0, 200)).toBe(false);
  });
});
