import { pakistanWallClockMs } from "../pakistanDate";

describe("pakistanWallClockMs", () => {
  it("reads API wall-clock text as Pakistan time (UTC+5), whatever the phone's time zone", () => {
    expect(pakistanWallClockMs("2026-10-20T10:00:00")).toBe(Date.UTC(2026, 9, 20, 5, 0));
    expect(pakistanWallClockMs("2026-10-20T10:00:00.000")).toBe(Date.UTC(2026, 9, 20, 5, 0));
    expect(pakistanWallClockMs("2026-10-20 10:30")).toBe(Date.UTC(2026, 9, 20, 5, 30));
  });

  it("reads a date alone as midnight in Pakistan (the evening before in UTC)", () => {
    expect(pakistanWallClockMs("2026-10-20")).toBe(Date.UTC(2026, 9, 19, 19, 0));
  });

  it("keeps text that carries Z or an offset as it is", () => {
    expect(pakistanWallClockMs("2026-10-20T05:00:00Z")).toBe(Date.UTC(2026, 9, 20, 5, 0));
    expect(pakistanWallClockMs("2026-10-20T10:00:00+05:00")).toBe(Date.UTC(2026, 9, 20, 5, 0));
  });

  it("is NaN for anything that is not a date", () => {
    expect(pakistanWallClockMs("")).toBeNaN();
    expect(pakistanWallClockMs(null)).toBeNaN();
    expect(pakistanWallClockMs(undefined)).toBeNaN();
    expect(pakistanWallClockMs("tomorrow")).toBeNaN();
  });
});
