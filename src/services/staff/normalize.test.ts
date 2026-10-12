import {
  addMonthsToApiDate,
  bool,
  buildQuery,
  idList,
  isApiDate,
  isEnvelope,
  num,
  optNum,
  optStr,
  parseApiDate,
  pick,
  str,
  toApiDate,
  toApiDateTime,
  toList,
  toPage,
  unwrapEnvelope,
  utcIso,
  withQuery,
} from "./normalize";

describe("buildQuery / withQuery", () => {
  it("skips empty values and encodes the rest", () => {
    expect(buildQuery({ page: 1, limit: 20, search: "  ", status: null, x: undefined })).toBe("?page=1&limit=20");
    expect(buildQuery({ search: "Ali & Co" })).toBe("?search=Ali%20%26%20Co");
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ n: Number.NaN })).toBe("");
    expect(buildQuery({ flag: false })).toBe("?flag=false");
  });

  it("joins arrays with commas (locationIds=1,2) and drops empty arrays", () => {
    expect(buildQuery({ locationIds: [1, 2] })).toBe("?locationIds=1%2C2");
    expect(buildQuery({ locationIds: [] })).toBe("");
  });

  it("withQuery appends to a path", () => {
    expect(withQuery("/customer", { page: 2, search: "ali" })).toBe("/customer?page=2&search=ali");
    expect(withQuery("/customer", {})).toBe("/customer");
  });
});

describe("envelopes", () => {
  it("detects and unwraps ApiResponse", () => {
    expect(isEnvelope({ isSuccessful: true, data: [1] })).toBe(true);
    expect(isEnvelope({ data: [1], total: 1 })).toBe(false);
    expect(isEnvelope([1])).toBe(false);
    expect(unwrapEnvelope({ isSuccessful: true, message: "Success", data: { id: 1 } })).toEqual({ id: 1 });
    expect(unwrapEnvelope({ isSuccessful: true, data: null })).toBeNull();
    expect(unwrapEnvelope({ id: 2 })).toEqual({ id: 2 });
  });
});

describe("toPage", () => {
  const id = (r: any) => r.id;

  it("PaginatedResponse { data, total }", () => {
    const page = toPage({ data: [{ id: 1 }, { id: 2 }], total: 5 }, id, { page: 1, limit: 2 });
    expect(page).toEqual({ items: [1, 2], total: 5, page: 1, limit: 2, hasMore: true });
  });

  it("{ data, total, page, limit } uses the server's paging", () => {
    const page = toPage({ data: [{ id: 3 }], total: 3, page: 3, limit: 1 }, id, { page: 9, limit: 9 });
    expect(page).toMatchObject({ items: [3], total: 3, page: 3, limit: 1, hasMore: false });
  });

  it("{ isSuccessful, data, totalCount, page, limit } (agreements / invoices)", () => {
    const page = toPage({ isSuccessful: true, data: [{ id: 1 }], totalCount: 11, page: 1, limit: 10 }, id);
    expect(page).toMatchObject({ items: [1], total: 11, hasMore: true });
  });

  it("{ items, total, page, limit } (KYC)", () => {
    expect(toPage({ items: [{ id: 7 }], total: 1, page: 1, limit: 20 }, id)).toMatchObject({ items: [7], total: 1, hasMore: false });
  });

  it("ApiResponse wrapping a page (fee receipts)", () => {
    const raw = { isSuccessful: true, data: { data: [{ id: 1 }, { id: 2 }], totalCount: 4, page: 1, limit: 2 } };
    expect(toPage(raw, id)).toMatchObject({ items: [1, 2], total: 4, page: 1, limit: 2, hasMore: true });
  });

  it("bare array without a total guesses hasMore from a full page (customers)", () => {
    expect(toPage([{ id: 1 }, { id: 2 }], id, { page: 2, limit: 2 })).toMatchObject({ total: 4, hasMore: true });
    expect(toPage([{ id: 1 }], id, { page: 2, limit: 2 })).toMatchObject({ total: 3, hasMore: false });
    expect(toPage({ isSuccessful: true, data: [{ id: 1 }] }, id, { page: 1, limit: 20 })).toMatchObject({ items: [1], hasMore: false });
  });

  it("anything else is an empty page", () => {
    expect(toPage(null, id)).toMatchObject({ items: [], total: 0, hasMore: false });
    expect(toList({ isSuccessful: true, data: null }, id)).toEqual([]);
  });
});

describe("field readers", () => {
  const row = { name: "Ali", Total: "12.5", flag: "true", blank: "  ", zero: 0, Nested: null };

  it("pick tries camelCase then PascalCase", () => {
    expect(pick(row, "total")).toBe("12.5");
    expect(pick(row, "missing", "name")).toBe("Ali");
    expect(pick(null, "x")).toBeUndefined();
  });

  it("str / optStr / num / optNum / bool", () => {
    expect(str(row, "name")).toBe("Ali");
    expect(str(row, "missing")).toBe("");
    expect(optStr(row, "blank")).toBeNull();
    expect(num(row, "total")).toBe(12.5);
    expect(num(row, "name")).toBe(0);
    expect(optNum(row, "zero")).toBe(0);
    expect(optNum(row, "blank")).toBeNull();
    expect(optNum(row, "missing")).toBeNull();
    expect(bool(row, "flag")).toBe(true);
    expect(bool({ x: 1 }, "x")).toBe(true);
    expect(bool({ x: "no" }, "x")).toBe(false);
  });

  it("idList keeps positive finite ids", () => {
    expect(idList([1, 0, -2, Number.NaN, 3])).toEqual([1, 3]);
    expect(idList(null)).toEqual([]);
  });
});

describe("dates", () => {
  it("formats local dates for the API", () => {
    const d = new Date(2026, 0, 5, 9, 7, 3);
    expect(toApiDate(d)).toBe("2026-01-05");
    expect(toApiDateTime(d)).toBe("2026-01-05T09:07:03");
  });

  it("validates and parses yyyy-MM-dd", () => {
    expect(isApiDate("2026-02-28")).toBe(true);
    expect(isApiDate("2026-02-30")).toBe(false);
    expect(isApiDate("28/02/2026")).toBe(false);
    expect(isApiDate(null)).toBe(false);
    expect(parseApiDate("2026-03-01")?.getDate()).toBe(1);
  });

  it("adds months like the CMS quotation form", () => {
    expect(addMonthsToApiDate("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonthsToApiDate("2026-10-12", 3)).toBe("2027-01-12");
    expect(addMonthsToApiDate("bad", 1)).toBeNull();
  });

  it("utcIso adds a Z to offset-less UTC values only", () => {
    expect(utcIso("2026-10-12T08:30:00.123")).toBe("2026-10-12T08:30:00.123Z");
    expect(utcIso("2026-10-12T08:30:00Z")).toBe("2026-10-12T08:30:00Z");
    expect(utcIso("2026-10-12T08:30:00+05:00")).toBe("2026-10-12T08:30:00+05:00");
    expect(utcIso("2026-10-12")).toBe("2026-10-12");
    expect(utcIso("")).toBeNull();
  });
});
