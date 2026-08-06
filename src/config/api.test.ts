import { normalizeApiBaseUrl } from "./api";

describe("normalizeApiBaseUrl", () => {
  it("appends /api when the configured base URL does not include one", () => {
    expect(normalizeApiBaseUrl("https://aeo.eaccounting360.com.pk/WorkNest")).toBe(
      "https://aeo.eaccounting360.com.pk/WorkNest/api"
    );
  });

  it("preserves an existing /api suffix", () => {
    expect(normalizeApiBaseUrl("https://aeo.eaccounting360.com.pk/WorkNest/api")).toBe(
      "https://aeo.eaccounting360.com.pk/WorkNest/api"
    );
  });
});
