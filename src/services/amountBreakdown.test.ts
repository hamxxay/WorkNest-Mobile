import { breakdownValue, monthsLabel, normalizeBreakdownFields, splitBreakdown } from "./amountBreakdown";

// GET /booking/557/challan (test database): ledger lines 94,500 + 189,000, but the challan's total is 470,480.
const CHALLAN_557 = {
  fields: [
    { label: "Space No.", value: "309", key: "spaceNo", isHeader: true },
    { label: "Space Name", value: "Office 309", key: "spaceName", isHeader: true },
    { label: "Contract Period", value: "05 Nov 2026 - 05 Nov 2027", key: "contractPeriod", isHeader: false },
    { label: "Billing Period", value: "3 Months", key: "billingPeriod", isHeader: false },
    { label: "Advance Rent Period", value: "3 Months", key: "advanceRentPeriod", isHeader: false },
    { label: "Advance Rent (3 Months)", value: "PKR 297,500", key: "advanceRent", isHeader: false },
    { label: "Monthly Rent", value: "PKR 105,000", key: "monthlyRent", isHeader: false },
    { label: "Security Deposit (Refundable)", value: "PKR 170,100", key: "securityDeposit", isHeader: false },
    { label: "Provincial Sales Tax", value: "PKR 2,880", key: "tax", isHeader: false },
    { label: "TOTAL INITIAL AMOUNT PAYABLE", value: "PKR 470,480", key: "totalAmount", isHeader: false },
  ],
};

/** "PKR 297,500" / "- PKR 1,000" -> 297500 / -1000. */
const amount = (value: string) => {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return value.trim().startsWith("-") ? -n : n;
};

describe("amount breakdown (challan / quotation fields)", () => {
  it("splits the fields so the amount rows add up to the total payable", () => {
    const parts = splitBreakdown(normalizeBreakdownFields(CHALLAN_557));
    expect(parts.amounts.map((f) => f.key)).toEqual(["advanceRent", "securityDeposit", "tax"]);
    expect(parts.terms.map((f) => f.key)).toEqual([
      "contractPeriod",
      "billingPeriod",
      "advanceRentPeriod",
      "monthlyRent",
    ]);
    expect(parts.total?.value).toBe("PKR 470,480");
    const sum = parts.amounts.reduce((acc, f) => acc + amount(f.value), 0);
    expect(sum).toBe(amount(parts.total!.value));
  });

  it("adds up quotation 238 (advance 525,000 + deposit 350,000 + tax 4,800 = 879,800)", () => {
    const parts = splitBreakdown(
      normalizeBreakdownFields({
        Fields: [
          { Label: "Advance Rent (3 Months)", Value: "PKR 525,000", Key: "advanceRent", IsHeader: false },
          { Label: "Monthly Rent", Value: "PKR 175,000", Key: "monthlyRent", IsHeader: false },
          { Label: "Security Deposit (Refundable)", Value: "PKR 350,000", Key: "securityDeposit", IsHeader: false },
          { Label: "Provincial Sales Tax", Value: "PKR 4,800", Key: "tax", IsHeader: false },
          { Label: "TOTAL INITIAL AMOUNT PAYABLE", Value: "PKR 879,800", Key: "totalAmount", IsHeader: false },
        ],
      }),
    );
    expect(parts.amounts.reduce((acc, f) => acc + amount(f.value), 0)).toBe(879800);
  });

  it("subtracts a discount and keeps withholding-tax rows after the total", () => {
    const parts = splitBreakdown(
      normalizeBreakdownFields({
        fields: [
          { label: "Rent/Booking Amount", value: "PKR 12,000", key: "rentAmount" },
          { label: "Support & Service Charges", value: "PKR 1,200", key: "supportCharge" },
          { label: "Provincial Sales Tax (16% on Support)", value: "PKR 192", key: "tax" },
          { label: "Discount", value: "PKR 1,000", key: "discount" },
          { label: "TOTAL INITIAL AMOUNT PAYABLE", value: "PKR 11,192", key: "totalAmount" },
          { label: "Withholding Tax (15%)", value: "PKR 1,800", key: "whtAmount" },
          { label: "Net Payable (After Tax Withheld)", value: "PKR 9,392", key: "netPayable" },
        ],
      }),
    );
    expect(parts.amounts.find((f) => f.key === "discount")?.value).toBe("- PKR 1,000");
    // The support charge is already inside the rent: information, not added again.
    expect(parts.terms.map((f) => f.key)).toEqual(["supportCharge"]);
    expect(parts.amounts.reduce((acc, f) => acc + amount(f.value), 0)).toBe(11192);
    expect(parts.afterTotal.map((f) => f.key)).toEqual(["whtAmount", "netPayable"]);
  });

  it("ignores missing or empty fields", () => {
    expect(normalizeBreakdownFields(null)).toEqual([]);
    expect(normalizeBreakdownFields({ fields: [{ label: "", value: "x" }, { label: "A", value: "" }] })).toEqual([]);
    expect(splitBreakdown([])).toEqual({ terms: [], amounts: [], total: null, afterTotal: [] });
  });

  it("reads one field and labels months", () => {
    const fields = normalizeBreakdownFields(CHALLAN_557);
    expect(breakdownValue(fields, "advanceRentPeriod")).toBe("3 Months");
    expect(breakdownValue(fields, "missing")).toBeNull();
    expect(monthsLabel(3)).toBe("3 months");
    expect(monthsLabel(1)).toBe("1 month");
    expect(monthsLabel(0)).toBeNull();
    expect(monthsLabel(null)).toBeNull();
  });
});
