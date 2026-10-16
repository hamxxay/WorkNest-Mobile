import {
  DEPOSIT_MONTH_OPTIONS,
  SHARED_SPACE_DEPOSIT_HINT,
  defaultDepositMonths,
  depositFieldState,
  depositHelperText,
  depositKindFromCategory,
  depositMonthsLabel,
  depositMonthsToSend,
  isValidDepositMonths,
  quotationSavedDeposit,
  rentDiscountPercent,
  savedDepositMonths,
  savedSecurityDeposit,
  securityDepositAmount,
} from "../securityDeposit";

describe("security deposit field", () => {
  it("offers 0-3 months, 0 reading 'No deposit'", () => {
    expect(DEPOSIT_MONTH_OPTIONS.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(DEPOSIT_MONTH_OPTIONS.map((o) => o.label)).toEqual(["No deposit", "1 month", "2 months", "3 months"]);
    expect(depositMonthsLabel(1)).toBe("1 month");
  });

  it("private offices: editable, default 2; shared: shown, locked at 0; meeting rooms: hidden, 0", () => {
    expect(depositFieldState("private")).toEqual({ visible: true, editable: true });
    expect(depositFieldState("shared")).toEqual({ visible: true, editable: false });
    expect(depositFieldState("meeting")).toEqual({ visible: false, editable: false });
    expect(defaultDepositMonths("private")).toBe(2);
    expect(defaultDepositMonths("shared")).toBe(0);
    expect(defaultDepositMonths("meeting")).toBe(0);
  });

  it("sends the private choice (0 stays 0) and always 0 for shared spaces and meeting rooms", () => {
    expect(depositMonthsToSend("private", 0)).toBe(0);
    expect(depositMonthsToSend("private", 3)).toBe(3);
    expect(depositMonthsToSend("shared", 2)).toBe(0);
    expect(depositMonthsToSend("meeting", 3)).toBe(0);
    expect(isValidDepositMonths(4)).toBe(false);
    expect(isValidDepositMonths(1.5)).toBe(false);
  });

  it("hint: the locked shared-space note, or the amount the months come to", () => {
    const fmt = (n: number) => `PKR ${n.toLocaleString("en-US")}`;
    expect(depositHelperText("shared", 0, 0, fmt)).toBe(SHARED_SPACE_DEPOSIT_HINT);
    expect(SHARED_SPACE_DEPOSIT_HINT).toBe("Shared spaces have no security deposit");
    expect(depositHelperText("meeting", 0, 0, fmt)).toBeUndefined();
    expect(depositHelperText("private", 0, 0, fmt)).toBe("No security deposit.");
    expect(depositHelperText("private", 2, 126000, fmt)).toBe("PKR 126,000 refundable: 2 months of rent after the discount.");
    expect(depositHelperText("private", 2, 0, fmt)).toBe("2 months of rent after the discount (refundable).");
  });
});

describe("security deposit amount", () => {
  it("months x monthly rent x (1 - discount %), 2 decimals", () => {
    expect(securityDepositAmount(2, 70000, 10)).toBe(126000);
    expect(securityDepositAmount(3, 33333.33, 7.5)).toBe(92499.99);
    expect(securityDepositAmount(0, 70000, 10)).toBe(0);
    expect(securityDepositAmount(2, 0, 0)).toBe(0);
  });

  it("the deposit gets the rent's discount: a PKR discount as its share of one month's rent", () => {
    expect(rentDiscountPercent("Percentage", 10, 70000)).toBe(10);
    expect(rentDiscountPercent("Amount", 7000, 70000)).toBe(10);
    expect(rentDiscountPercent("Fixed", 7000, 70000)).toBe(10);
    expect(rentDiscountPercent("Amount", 7000, 0)).toBe(0);
    expect(rentDiscountPercent("Percentage", 150, 70000)).toBe(100);
    expect(rentDiscountPercent("Percentage", 0, 70000)).toBe(0);
  });
});

describe("a saved quotation / booking", () => {
  const base = { monthlyRent: 70000, discountPercent: 10 };

  it("uses the stored amount (older rows keep theirs)", () => {
    expect(savedSecurityDeposit({ ...base, amount: 70000, months: 2 })).toBe(70000);
    expect(savedSecurityDeposit({ ...base, amount: 70000, months: null, kind: "shared" })).toBe(70000);
  });

  it("stored amount 0 with months: months x rent x (1 - discount); both 0 or missing: no deposit", () => {
    expect(savedSecurityDeposit({ ...base, amount: 0, months: 2 })).toBe(126000);
    expect(savedSecurityDeposit({ ...base, amount: 0, months: 0 })).toBe(0);
    expect(savedSecurityDeposit({ ...base, amount: null, months: null })).toBe(0);
    expect(savedSecurityDeposit({ ...base, amount: 0, months: 2, kind: "shared" })).toBe(0);
  });

  it("prefill months: the stored months, else the months the stored amount stands for, never a default 2", () => {
    expect(savedDepositMonths({ ...base, amount: 63000, months: 1 })).toBe(1);
    expect(savedDepositMonths({ ...base, amount: 0, months: 0 })).toBe(0);
    expect(savedDepositMonths({ ...base, amount: null, months: null })).toBe(0);
    expect(savedDepositMonths({ ...base, amount: 189000, months: null })).toBe(3);
    expect(savedDepositMonths({ ...base, amount: 126000, months: 0 })).toBe(2);
    expect(savedDepositMonths({ ...base, amount: 63000, months: 3, kind: "shared" })).toBe(0);
  });

  it("reads a quotation response (percent or PKR discount; category from spaceType)", () => {
    const q = {
      securityDeposit: 0,
      securityDepositMonths: 2,
      monthlyBasePrice: 70000,
      monthlyRent: 70000,
      discountType: "Amount",
      discountPercentage: 0,
      discountValue: 7000,
      spaceType: "PrivateOffice",
    };
    expect(quotationSavedDeposit(q)).toEqual({ amount: 0, months: 2, monthlyRent: 70000, discountPercent: 10, kind: "private" });
    expect(savedSecurityDeposit(quotationSavedDeposit(q))).toBe(126000);
    expect(quotationSavedDeposit({ ...q, discountType: "Percentage", discountPercentage: 5, discountValue: 5 }).discountPercent).toBe(5);
    expect(savedSecurityDeposit(quotationSavedDeposit({ ...q, spaceType: "SharedSpace" }))).toBe(0);
  });

  it("space kind from the category code or type name", () => {
    expect(depositKindFromCategory("PrivateOffice")).toBe("private");
    expect(depositKindFromCategory("SharedSpace")).toBe("shared");
    expect(depositKindFromCategory("MeetingRoom")).toBe("meeting");
    expect(depositKindFromCategory(null, "Hot Desk")).toBe("shared");
    expect(depositKindFromCategory(null, "Open co-working area")).toBe("shared");
    expect(depositKindFromCategory("", "Conference room")).toBe("meeting");
    expect(depositKindFromCategory(null, null)).toBeNull();
  });
});
