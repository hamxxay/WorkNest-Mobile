// Quotation discount limits: the same rules as the API (QuotationService.CreateQuotationAsync) and the CMS
// (manage.ts quotationDynamicDiscountCap / quotationMaxAllowedDiscountFixed). Pure, unit-tested.
//
//   * The offering type's cap (WN_OfferingType.DiscountCap, e.g. 10% for 24/7; 10% when the offering is unknown) protects
//     a floor price per seat: the standard price minus the cap (35,000 - 10% = 31,500).
//   * A base price raised above the standard price widens the cap so the discounted price can come down to that same
//     floor, never below it (40,000 -> up to 21.25%, i.e. PKR 8,500 per seat). Meeting rooms keep the plain cap.
//   * Percent: at most the cap. Amount (PKR): at most the cap of one month's rent (raised price: (price - floor) x seats).
//     The API takes a PKR discount once off the contract total, a percent off every month.
//   * The API silently lowers a larger discount to the limit; the form shows an error instead, and the estimate shows
//     only what the API will apply.

export type QuotationDiscountKind = "Percentage" | "Amount";

export type DiscountLimitInput = {
  /** The offering type's cap at the standard price (percent); null / undefined = unknown offering (the API uses 10). */
  offeringCapPercent: number | null | undefined;
  /** The space's standard monthly price per seat (the lowest base price allowed). */
  standardPerSeat: number;
  /** The base price per seat on the quotation; 0 / empty = the standard price. */
  perSeat: number;
  /** Seats the API multiplies the price by (the space's capacity; at least 1). */
  seats: number;
  isMeetingRoom: boolean;
};

export type DiscountLimit = {
  /** Largest percent discount. */
  capPercent: number;
  /** Largest PKR discount; null when the monthly rent is not known here (meeting rooms: the API checks it). */
  maxAmount: number | null;
  /** Lowest price per seat after the discount (0 for meeting rooms). */
  floorPerSeat: number;
  /** Monthly rent the discount applies to: price per seat x seats (0 for meeting rooms). */
  monthlyRent: number;
  /** True when a raised base price widened the cap. */
  widened: boolean;
};

/** The API's default cap when the offering type is not found. */
export const DEFAULT_DISCOUNT_CAP = 10;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Two decimals, rounded toward zero (the API's MidpointRounding.ToZero); the epsilon absorbs float noise (21.25). */
const truncate2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

export function quotationDiscountLimit(input: DiscountLimitInput): DiscountLimit {
  const cap = input.offeringCapPercent != null && Number.isFinite(input.offeringCapPercent) && input.offeringCapPercent >= 0
    ? input.offeringCapPercent
    : DEFAULT_DISCOUNT_CAP;
  if (input.isMeetingRoom) return { capPercent: cap, maxAmount: null, floorPerSeat: 0, monthlyRent: 0, widened: false };

  const standard = input.standardPerSeat > 0 ? input.standardPerSeat : 0;
  const perSeat = input.perSeat > 0 ? input.perSeat : standard;
  const seats = Math.max(1, Math.floor(Number(input.seats) || 1));
  const monthlyRent = round2(perSeat * seats);
  const floorPerSeat = round2(standard * (1 - cap / 100));
  if (standard > 0 && perSeat > standard) {
    const floor = standard * (1 - cap / 100);
    return {
      capPercent: truncate2(((perSeat - floor) / perSeat) * 100),
      maxAmount: round2((perSeat - floor) * seats),
      floorPerSeat,
      monthlyRent,
      widened: true,
    };
  }
  return {
    capPercent: cap,
    maxAmount: monthlyRent > 0 ? round2((monthlyRent * cap) / 100) : null,
    floorPerSeat,
    monthlyRent,
    widened: false,
  };
}

/** What the API will take off: the discount lowered to the limit (percent: per month of rent; PKR: once). */
export function allowedDiscount(kind: QuotationDiscountKind, value: number, limit: DiscountLimit): number {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  if (kind === "Percentage") return Math.min(v, limit.capPercent);
  return limit.maxAmount == null ? v : Math.min(v, limit.maxAmount);
}

/** The discount in PKR per month of rent for the estimate (percent), or the one-off PKR amount (amount). */
export function discountEstimate(kind: QuotationDiscountKind, value: number, limit: DiscountLimit): number {
  const allowed = allowedDiscount(kind, value, limit);
  return kind === "Percentage" ? round2((limit.monthlyRent * allowed) / 100) : allowed;
}

/** Plain-language error for a discount the API would lower (or that is not a number); null when it is fine. */
export function discountError(
  kind: QuotationDiscountKind,
  value: number,
  limit: DiscountLimit,
  offeringName?: string | null,
  formatAmount: (n: number) => string = (n) => `PKR ${n}`,
): string | null {
  if (!Number.isFinite(value) || value < 0) return "Enter a valid discount.";
  if (value === 0) return null;
  const forOffering = offeringName ? ` for ${offeringName}` : "";
  const why = limit.widened ? ` (the price can't go below ${formatAmount(limit.floorPerSeat)} per seat)` : "";
  if (kind === "Percentage") {
    if (value > 100) return "The discount can't be more than 100%.";
    if (value > limit.capPercent + 1e-9) return `The discount can be at most ${limit.capPercent}%${forOffering}${why}.`;
    return null;
  }
  if (limit.maxAmount != null && value > limit.maxAmount + 0.005) {
    return `The discount can be at most ${formatAmount(limit.maxAmount)} (${limit.capPercent}%)${forOffering}${why}.`;
  }
  return null;
}
