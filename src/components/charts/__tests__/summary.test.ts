import { formatMoney } from "../../../utils/format";
import { defaultFormat, describeTrend, sentences, summarizeBars, summarizeDonut, summarizeList } from "../summary";

const money = (v: number) => formatMoney(v, { compact: true });

describe("sentences", () => {
  it("joins the non-empty parts as sentences", () => {
    expect(sentences(["Pipeline", null, "", "Draft 3, Sent 5", false])).toBe("Pipeline. Draft 3, Sent 5.");
    expect(sentences(["Done."])).toBe("Done.");
  });
  it("starts every sentence with a capital", () => {
    expect(sentences(["Occupancy", "trend rising over 4 periods"])).toBe("Occupancy. Trend rising over 4 periods.");
  });
});

describe("defaultFormat", () => {
  it("groups digits and drops trailing zeros", () => {
    expect(defaultFormat(1_250_000)).toBe("1,250,000");
    expect(defaultFormat(72.4)).toBe("72.4");
    expect(defaultFormat(1234.5)).toBe("1,234.5");
    expect(defaultFormat(0)).toBe("0");
    expect(defaultFormat(1000)).toBe("1,000");
  });
});

describe("summarizeBars", () => {
  const series = [{ label: "Invoiced" }, { label: "Paid" }];
  it("lists every category with its series values", () => {
    expect(
      summarizeBars({
        label: "Invoiced and paid by month",
        data: [
          { label: "Sep", title: "Sep 2026", values: [1_200_000, 900_000] },
          { label: "Oct", title: "Oct 2026", values: [1_500_000, 0] },
        ],
        series,
        format: money,
      }),
    ).toBe("Invoiced and paid by month. Sep 2026: Invoiced PKR 1.2M, Paid PKR 900K. Oct 2026: Invoiced PKR 1.5M, Paid PKR 0.");
  });
  it("leaves out the series name for a single series", () => {
    expect(
      summarizeBars({ label: "Expected rent", data: [{ label: "Nov", values: [250_000] }], series: [{ label: "Rent" }], format: money }),
    ).toBe("Expected rent. Nov: PKR 250K.");
  });
  it("says when there is nothing to show", () => {
    expect(summarizeBars({ label: "Expected rent", data: [{ label: "Nov", values: [0] }], series: [{ label: "Rent" }] })).toBe(
      "Expected rent. No data.",
    );
    expect(summarizeBars({ data: [], series, emptyText: "No invoices yet" })).toBe("No invoices yet.");
  });
});

describe("summarizeList", () => {
  it("uses value labels when given", () => {
    expect(
      summarizeList({
        label: "Occupancy by location",
        items: [
          { label: "Gulberg", value: 72, valueLabel: "72%" },
          { label: "DHA", value: 40 },
        ],
      }),
    ).toBe("Occupancy by location. Gulberg 72%, DHA 40.");
  });
  it("says when the list is empty", () => {
    expect(summarizeList({ label: "Pipeline", items: [] })).toBe("Pipeline. No data.");
  });
});

describe("summarizeDonut", () => {
  it("reads the centre figure and the parts of the whole", () => {
    expect(
      summarizeDonut({ label: "Occupancy", center: "72%", centerCaption: "occupied", segments: [{ label: "Occupied", value: 18 }], total: 25 }),
    ).toBe("Occupancy. 72% occupied. Occupied 18 of 25.");
  });
  it("lists segments without a total", () => {
    expect(summarizeDonut({ segments: [{ label: "Won", value: 2 }, { label: "Lost", value: 3 }] })).toBe("Won 2, Lost 3.");
  });
});

describe("describeTrend", () => {
  it("describes direction, ends and range", () => {
    expect(describeTrend([62, 58, 71])).toBe("trend rising over 3 periods, from 62 to 71, low 58, high 71");
    expect(describeTrend([1_200_000, 900_000], money)).toBe(
      "trend falling over 2 periods, from PKR 1.2M to PKR 900K, low PKR 900K, high PKR 1.2M",
    );
    expect(describeTrend([5, 5])).toBe("trend steady over 2 periods, from 5 to 5");
  });
  it("is empty for fewer than two points", () => {
    expect(describeTrend([4])).toBe("");
  });
});
