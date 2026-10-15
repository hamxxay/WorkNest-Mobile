import { allowedDiscount, discountError, discountEstimate, quotationDiscountLimit } from "../quotationDiscount";

// Same numbers as the API (QuotationService) and the CMS: standard 35,000 per seat, 24/7 cap 10% -> floor 31,500.
const base = { offeringCapPercent: 10, standardPerSeat: 35000, perSeat: 35000, seats: 1, isMeetingRoom: false };

describe("quotationDiscountLimit", () => {
  it("at the standard price: the offering's cap, and the same cap of one month in PKR", () => {
    const limit = quotationDiscountLimit({ ...base, seats: 4 });
    expect(limit).toMatchObject({ capPercent: 10, maxAmount: 14000, floorPerSeat: 31500, monthlyRent: 140000, widened: false });
  });

  it("a raised base price widens the cap down to the same floor (40,000 -> 21.25%, PKR 8,500 a seat)", () => {
    const limit = quotationDiscountLimit({ ...base, perSeat: 40000, seats: 2 });
    expect(limit.capPercent).toBe(21.25);
    expect(limit.maxAmount).toBe(17000);
    expect(limit.widened).toBe(true);
    // Rounded toward zero, as the API: (37,000 - 31,500) / 37,000 = 14.864...%
    expect(quotationDiscountLimit({ ...base, perSeat: 37000 }).capPercent).toBe(14.86);
  });

  it("an unknown offering uses the API's 10%; a 0% offering allows no discount", () => {
    expect(quotationDiscountLimit({ ...base, offeringCapPercent: null }).capPercent).toBe(10);
    expect(quotationDiscountLimit({ ...base, offeringCapPercent: 0 }).maxAmount).toBe(0);
  });

  it("meeting rooms keep the plain cap; the PKR limit is left to the API", () => {
    expect(quotationDiscountLimit({ ...base, isMeetingRoom: true })).toMatchObject({ capPercent: 10, maxAmount: null, monthlyRent: 0 });
  });
});

describe("discount checks and estimate", () => {
  const limit = quotationDiscountLimit({ ...base, perSeat: 40000 });

  it("accepts a discount up to the limit, refuses one above (percent and PKR)", () => {
    expect(discountError("Percentage", 21.25, limit)).toBeNull();
    expect(discountError("Percentage", 22, limit, "24/7")).toBe(
      "The discount can be at most 21.25% for 24/7 (the price can't go below PKR 31500 per seat).",
    );
    expect(discountError("Amount", 8500, limit)).toBeNull();
    expect(discountError("Amount", 9000, limit, null, (n) => `Rs ${n}`)).toBe(
      "The discount can be at most Rs 8500 (21.25%) (the price can't go below Rs 31500 per seat).",
    );
    expect(discountError("Percentage", 101, limit)).toBe("The discount can't be more than 100%.");
    expect(discountError("Amount", Number.NaN, limit)).toBe("Enter a valid discount.");
    expect(discountError("Amount", 0, limit)).toBeNull();
  });

  it("at the standard price a fixed PKR discount is checked too", () => {
    const standard = quotationDiscountLimit(base);
    expect(discountError("Amount", 3500, standard)).toBeNull();
    expect(discountError("Amount", 5000, standard)).not.toBeNull();
  });

  it("the estimate shows only what the API applies, never the full typed discount", () => {
    expect(allowedDiscount("Percentage", 50, limit)).toBe(21.25);
    expect(discountEstimate("Percentage", 50, limit)).toBe(8500);
    expect(discountEstimate("Percentage", 5, limit)).toBe(2000);
    expect(discountEstimate("Amount", 20000, limit)).toBe(8500);
    expect(discountEstimate("Amount", 1000, limit)).toBe(1000);
  });
});
