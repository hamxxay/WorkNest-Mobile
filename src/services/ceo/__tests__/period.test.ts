// The custom date range of the CEO and Sales Manager dashboards: checked as the API checks it, the previous period
// as many days just before it, the API's labels, the CMS's wording and the query names per call.

import { PERIOD_OPTIONS, periodWords } from "../format";
import {
  EARLIEST_DAY,
  MAX_RANGE_DAYS,
  calendarRange,
  checkRange,
  customRangeOf,
  drillPeriodParams,
  isValidRange,
  parseDay,
  periodQuery,
  periodTitleOf,
  periodWordsOf,
  previousRange,
  rangeDays,
  rangeDraft,
  rangeHint,
  rangeLabel,
  rangeOf,
  trendForPeriod,
  ymd,
} from "../period";

const TODAY = "2026-10-19";

describe("days", () => {
  it("reads and writes yyyy-MM-dd local days; impossible days are not days", () => {
    expect(ymd(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(parseDay("2026-10-05")?.getTime()).toBe(new Date(2026, 9, 5).getTime());
    expect(parseDay(" 2024-02-29 ")).not.toBeNull();
    for (const bad of ["2026-02-29", "2026-13-01", "2026-10-32", "2026-1-5", "05/10/2026", "", null, undefined]) {
      expect(parseDay(bad)).toBeNull();
    }
  });

  it("counts both days of a range; 0 when it is not one", () => {
    expect(rangeDays({ from: "2026-10-01", to: "2026-10-15" })).toBe(15);
    expect(rangeDays({ from: "2026-10-19", to: "2026-10-19" })).toBe(1);
    expect(rangeDays({ from: "2025-10-20", to: "2026-10-19" })).toBe(365);
    expect(rangeDays({ from: "2023-10-20", to: "2024-10-19" })).toBe(366);
    // Across the change of month and year.
    expect(rangeDays({ from: "2025-12-20", to: "2026-01-10" })).toBe(22);
    expect(rangeDays({ from: "2026-10-15", to: "2026-10-01" })).toBe(0);
    expect(rangeDays({ from: "2026-10-01", to: "x" })).toBe(0);
    expect(rangeDays(null)).toBe(0);
  });
});

describe("previousRange: as many days just before the range (the API's previous period)", () => {
  it.each([
    [{ from: "2026-10-01", to: "2026-10-15" }, { from: "2026-09-16", to: "2026-09-30" }],
    [{ from: "2026-10-19", to: "2026-10-19" }, { from: "2026-10-18", to: "2026-10-18" }],
    [{ from: "2026-03-01", to: "2026-03-31" }, { from: "2026-01-29", to: "2026-02-28" }],
    [{ from: "2026-01-01", to: "2026-01-10" }, { from: "2025-12-22", to: "2025-12-31" }],
    [{ from: "2024-03-01", to: "2024-03-02" }, { from: "2024-02-28", to: "2024-02-29" }],
    [{ from: "2025-10-20", to: "2026-10-19" }, { from: "2024-10-20", to: "2025-10-19" }],
  ])("%j -> %j", (range, previous) => {
    expect(previousRange(range)).toEqual(previous);
    expect(rangeDays(previousRange(range))).toBe(rangeDays(range));
  });

  it("null for a range that is not one", () => {
    expect(previousRange({ from: "2026-10-15", to: "2026-10-01" })).toBeNull();
  });
});

describe("rangeLabel: as the API labels a range", () => {
  it.each([
    [{ from: "2026-10-15", to: "2026-10-15" }, "15 Oct 2026"],
    [{ from: "2026-10-01", to: "2026-10-31" }, "October 2026"],
    [{ from: "2026-02-01", to: "2026-02-28" }, "February 2026"],
    [{ from: "2026-10-01", to: "2026-10-15" }, "1 Oct - 15 Oct 2026"],
    [{ from: "2026-09-20", to: "2026-10-19" }, "20 Sep - 19 Oct 2026"],
    [{ from: "2025-12-20", to: "2026-01-10" }, "20 Dec 2025 - 10 Jan 2026"],
  ])("%j -> %s", (range, label) => {
    expect(rangeLabel(range)).toBe(label);
  });

  it("'Custom range' when there is no usable range", () => {
    expect(rangeLabel(null)).toBe("Custom range");
    expect(rangeLabel({ from: "2026-10-15", to: "2026-10-01" })).toBe("Custom range");
  });
});

describe("checkRange: the API's rules", () => {
  it("accepts a range of up to 366 days, from 2000, ending today at the latest", () => {
    expect(checkRange("2026-10-01", "2026-10-15", TODAY)).toBeNull();
    expect(checkRange(TODAY, TODAY, TODAY)).toBeNull();
    expect(checkRange("2025-10-19", TODAY, TODAY)).toBeNull(); // 366 days
    expect(checkRange(EARLIEST_DAY, "2000-12-31", TODAY)).toBeNull(); // a leap year: 366 days
    expect(isValidRange({ from: "2026-10-01", to: "2026-10-15" }, TODAY)).toBe(true);
  });

  it.each([
    ["", "2026-10-15", "Choose both dates."],
    ["2026-10-01", null, "Choose both dates."],
    ["2026-02-30", "2026-03-15", "Choose real dates."],
    ["2026-10-16", "2026-10-15", "The start date must be on or before the end date."],
    ["1999-12-31", "2000-01-10", "Choose a start date in 2000 or later."],
    ["2026-10-01", "2026-10-20", "The end date cannot be after today."],
    ["2025-10-18", TODAY, `Choose at most ${MAX_RANGE_DAYS} days.`],
  ])("%s to %s: %s", (from, to, message) => {
    expect(checkRange(from, to, TODAY)).toBe(message);
    expect(isValidRange(from && to ? { from, to } : null, TODAY)).toBe(false);
  });
});

describe("the range editor", () => {
  const today = new Date(2026, 9, 19);

  it("opens with the current calendar period to today, or the range already chosen", () => {
    expect(calendarRange("month", today)).toEqual({ from: "2026-10-01", to: TODAY });
    expect(calendarRange("quarter", today)).toEqual({ from: "2026-10-01", to: TODAY });
    expect(calendarRange("year", today)).toEqual({ from: "2026-01-01", to: TODAY });
    expect(calendarRange("quarter", new Date(2026, 7, 5))).toEqual({ from: "2026-07-01", to: "2026-08-05" });
    expect(rangeDraft("year", null, today)).toEqual({ from: "2026-01-01", to: TODAY });
    expect(rangeDraft("custom", { from: "2026-09-01", to: "2026-09-10" }, today)).toEqual({ from: "2026-09-01", to: "2026-09-10" });
    // The range chosen before is kept while a calendar period is shown.
    expect(rangeDraft("month", { from: "2026-09-01", to: "2026-09-10" }, today)).toEqual({ from: "2026-09-01", to: "2026-09-10" });
    // Never after today (a range chosen yesterday that ran to a later day cannot exist, but stay safe).
    expect(rangeDraft("custom", { from: "2026-10-18", to: "2026-10-25" }, today)).toEqual({ from: "2026-10-18", to: TODAY });
  });

  it("says how long the range is and what it is compared with", () => {
    expect(rangeHint({ from: "2026-10-01", to: "2026-10-15" })).toBe("15 days, compared with the 15 days before.");
    expect(rangeHint({ from: TODAY, to: TODAY })).toBe("1 day, compared with the day before.");
    expect(rangeHint({ from: "2026-10-15", to: "2026-10-01" })).toBe("Up to 366 days, compared with the same number of days before.");
  });

  it("the period selector ends with Custom", () => {
    expect(PERIOD_OPTIONS.map((o) => o.value)).toEqual(["month", "quarter", "year", "custom"]);
    expect(PERIOD_OPTIONS[3]).toMatchObject({ label: "Custom", accessibilityLabel: "Custom date range" });
  });
});

describe("query building", () => {
  const range = { from: "2026-10-01", to: "2026-10-15" };

  it("month / quarter / year send only the period, exactly as before (also with a range kept aside)", () => {
    for (const period of ["month", "quarter", "year"] as const) {
      expect(periodQuery(period)).toEqual({ period });
      expect(periodQuery(period, range)).toEqual({ period });
      expect(drillPeriodParams({ period, range })).toEqual({});
      expect(customRangeOf({ period, range })).toBeNull();
    }
  });

  it("custom: from / to on the dashboard, rooms and complaints calls; periodFrom / periodTo on the drill-downs", () => {
    expect(periodQuery("custom", range)).toEqual({ period: "custom", from: "2026-10-01", to: "2026-10-15" });
    expect(drillPeriodParams({ period: "custom", range })).toEqual({ period: "custom", periodFrom: "2026-10-01", periodTo: "2026-10-15" });
    expect(customRangeOf({ period: "custom", range })).toEqual(range);
    // Without a usable range nothing is sent but the period.
    expect(periodQuery("custom", null)).toEqual({ period: "custom" });
    expect(customRangeOf({ period: "custom", range: { from: "2026-10-15", to: "2026-10-01" } })).toBeNull();
  });

  it("reads the range an answer covers", () => {
    expect(rangeOf("2026-10-01", "2026-10-15")).toEqual(range);
    expect(rangeOf(null, null)).toBeNull();
    expect(rangeOf("2026-10-01", undefined)).toBeNull();
    expect(rangeOf("2026-10-01T00:00:00", "2026-10-15")).toBeNull();
  });
});

describe("wording, as the CMS", () => {
  it("calendar periods: this month / last month / a month ago", () => {
    expect(periodWordsOf("month")).toEqual({ thisP: "this month", last: "last month", ago: "a month ago" });
    expect(periodWordsOf("quarter").last).toBe("last quarter");
    expect(periodWords("year")).toBe("this year");
    expect(periodTitleOf("quarter")).toBe("This quarter");
  });

  it("a custom range: in this range / previous N days / N days earlier", () => {
    expect(periodWords("custom")).toBe("in this range");
    expect(periodWordsOf("custom", { from: "2026-10-01", to: "2026-10-15" })).toEqual({
      thisP: "in this range",
      last: "previous 15 days",
      ago: "15 days earlier",
    });
    expect(periodWordsOf("custom", { from: TODAY, to: TODAY })).toEqual({ thisP: "in this range", last: "previous day", ago: "1 day earlier" });
    expect(periodWordsOf("custom", null).last).toBe("previous range");
    expect(periodTitleOf("custom", { from: "2026-10-01", to: "2026-10-15" })).toBe("1 Oct - 15 Oct 2026");
  });

  it("a KPI change says what it is compared with", () => {
    const range = { from: "2026-10-01", to: "2026-10-15" };
    // As services/staff/dashboard's dashboardTrend and salesManager/format's deskTrend word them.
    const t = { direction: "up" as const, label: "20% vs last period", upIsGood: true };
    expect(trendForPeriod(t, "month", range)).toBe(t);
    expect(trendForPeriod(t, "year", range)).toBe(t);
    expect(trendForPeriod(t, "custom", range)).toEqual({ ...t, label: "20% vs previous 15 days" });
    expect(trendForPeriod({ ...t, label: "2.0 pts vs last period" }, "custom", range, "ago")?.label).toBe("2.0 pts vs 15 days earlier");
    expect(trendForPeriod({ ...t, label: "6 vs last period" }, "custom", { from: TODAY, to: TODAY })?.label).toBe("6 vs previous day");
    // "no change" / "new" have no comparison to reword.
    expect(trendForPeriod({ ...t, label: "no change" }, "custom", range)?.label).toBe("no change");
    expect(trendForPeriod(undefined, "custom", range)).toBeUndefined();
  });
});
