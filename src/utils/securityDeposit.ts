// Security deposit (months): the owner's rule (16 Oct 2026), the same in the API, the CMS and the app. Pure, unit-tested.
//
//   * Months: 0, 1, 2 or 3. Private offices: editable, default 2. Shared spaces: always 0 (the field is shown, locked).
//     Meeting rooms / hourly: always 0 (the field is hidden).
//   * Amount = months x monthly rent x (1 - rent discount %), 2 decimals: the deposit gets the same discount as the
//     rent. A PKR discount counts as its percentage of one month's rent (as the API works it out).
//   * A saved quotation / booking: its stored amount; when that is 0 but months are stored (an older row),
//     months x rent x (1 - discount). Both 0 = no deposit. Never a default month count (0 / missing never becomes 2).

export type DepositSpaceKind = "private" | "shared" | "meeting";

export const SECURITY_DEPOSIT_MONTHS = [0, 1, 2, 3] as const;
export const DEFAULT_PRIVATE_DEPOSIT_MONTHS = 2;
export const SECURITY_DEPOSIT_FIELD_LABEL = "Security deposit (months)";
export const SHARED_SPACE_DEPOSIT_HINT = "Shared spaces have no security deposit";
export const NO_SECURITY_DEPOSIT = "No security deposit";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clampPercent = (p: number) => (Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0);
const positive = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** True for 0, 1, 2 or 3. */
export function isValidDepositMonths(months: unknown): months is number {
  return typeof months === "number" && Number.isInteger(months) && months >= 0 && months <= 3;
}

/** "No deposit", "1 month", "2 months". */
export function depositMonthsLabel(months: number): string {
  if (!(months > 0)) return "No deposit";
  return `${months} ${months === 1 ? "month" : "months"}`;
}

export const DEPOSIT_MONTH_OPTIONS = SECURITY_DEPOSIT_MONTHS.map((m) => ({ label: depositMonthsLabel(m), value: m as number }));

/** How the form shows the field: private editable, shared shown but locked at 0, meeting rooms hidden. */
export function depositFieldState(kind: DepositSpaceKind): { visible: boolean; editable: boolean } {
  if (kind === "private") return { visible: true, editable: true };
  if (kind === "shared") return { visible: true, editable: false };
  return { visible: false, editable: false };
}

/** The months a new form starts with: 2 for private offices, 0 otherwise. */
export function defaultDepositMonths(kind: DepositSpaceKind): number {
  return kind === "private" ? DEFAULT_PRIVATE_DEPOSIT_MONTHS : 0;
}

/** The months the form sends: the choice for private offices (0-3), always 0 for shared spaces and meeting rooms. */
export function depositMonthsToSend(kind: DepositSpaceKind, months: number): number {
  if (kind !== "private") return 0;
  return isValidDepositMonths(months) ? months : DEFAULT_PRIVATE_DEPOSIT_MONTHS;
}

/**
 * The rent discount as a percentage of the monthly rent: a percent as is; a PKR amount ("Amount" / "Fixed") as its
 * share of one month's rent. 0-100.
 */
export function rentDiscountPercent(discountType: string | null | undefined, value: number, monthlyRent: number): number {
  const v = positive(value);
  if (!v) return 0;
  const type = (discountType ?? "").trim().toLowerCase();
  if (type.startsWith("amount") || type === "fixed") return monthlyRent > 0 ? clampPercent((v / monthlyRent) * 100) : 0;
  return clampPercent(v);
}

/** months x monthly rent x (1 - discount %), 2 decimals; 0 when there are no months or no rent. */
export function securityDepositAmount(months: number, monthlyRent: number, discountPercent: number): number {
  const m = isValidDepositMonths(months) ? months : 0;
  const rent = positive(monthlyRent);
  if (!m || !rent) return 0;
  return Math.max(0, round2(m * rent * (1 - clampPercent(discountPercent) / 100)));
}

/** What a saved quotation / booking carries (any field may be missing on an older API). */
export type SavedDeposit = {
  /** Stored amount (securityDeposit). */
  amount: number | null | undefined;
  /** Stored months (securityDepositMonths); null / undefined when the API does not send them. */
  months: number | null | undefined;
  /** Monthly rent before the discount. */
  monthlyRent: number;
  /** The rent's discount percentage (rentDiscountPercent). */
  discountPercent: number;
  /** The space kind when known: a shared space / meeting room never gets a deposit worked out from months. */
  kind?: DepositSpaceKind | null;
};

/** The deposit of a saved quotation / booking: the stored amount, else months x rent x (1 - discount), else 0. */
export function savedSecurityDeposit(saved: SavedDeposit): number {
  const stored = positive(saved.amount);
  if (stored) return round2(stored);
  if (saved.kind === "shared" || saved.kind === "meeting") return 0;
  const months = isValidDepositMonths(saved.months) ? saved.months : 0;
  return securityDepositAmount(months, saved.monthlyRent, saved.discountPercent);
}

/**
 * The months to prefill from a saved quotation / booking (editing it as a new one): the stored months; when none are
 * stored but an amount is, the months that amount stands for (1-3); else 0. Never a default.
 */
export function savedDepositMonths(saved: SavedDeposit): number {
  if (saved.kind === "shared" || saved.kind === "meeting") return 0;
  if (isValidDepositMonths(saved.months) && saved.months > 0) return saved.months;
  const stored = positive(saved.amount);
  if (!stored) return 0;
  const perMonth = securityDepositAmount(1, saved.monthlyRent, saved.discountPercent);
  if (!perMonth) return 0;
  return Math.min(3, Math.max(1, Math.round(stored / perMonth)));
}

/** The saved quotation's deposit inputs (QuotationResponse: monthlyBasePrice / monthlyRent before the discount). */
export function quotationSavedDeposit(q: {
  securityDeposit: number | null | undefined;
  securityDepositMonths: number | null | undefined;
  monthlyBasePrice: number;
  monthlyRent: number;
  discountType: string | null;
  discountPercentage: number;
  discountValue: number;
  spaceType?: string | null;
  spaceTypeName?: string | null;
}): SavedDeposit {
  const monthlyRent = positive(q.monthlyBasePrice) || positive(q.monthlyRent);
  const isAmount = /^(amount|fixed)/i.test((q.discountType ?? "").trim());
  const discountPercent = isAmount
    ? rentDiscountPercent("Amount", q.discountValue, monthlyRent)
    : rentDiscountPercent("Percentage", positive(q.discountPercentage) || positive(q.discountValue), monthlyRent);
  return {
    amount: q.securityDeposit,
    months: q.securityDepositMonths,
    monthlyRent,
    discountPercent,
    kind: depositKindFromCategory(q.spaceType, q.spaceTypeName),
  };
}

/**
 * The space kind from a saved row's category code / type name (the API's detection): PrivateOffice / Private;
 * SharedSpace / Shared or a name with shared / co-working / coworking / open / desk; MeetingRoom / Conference /
 * hourly. null when neither tells.
 */
export function depositKindFromCategory(category: string | null | undefined, typeName?: string | null): DepositSpaceKind | null {
  const c = (category ?? "").trim().toLowerCase();
  if (c.includes("private")) return "private";
  if (c.includes("shared")) return "shared";
  if (c.includes("meeting") || c.includes("conference") || c.includes("hourly")) return "meeting";
  const n = (typeName ?? "").trim().toLowerCase();
  if (n.includes("meeting") || n.includes("conference") || n.includes("hourly")) return "meeting";
  if (n.includes("private")) return "private";
  if (["shared", "co-working", "coworking", "open", "desk"].some((w) => n.includes(w))) return "shared";
  return null;
}

/** The hint under the field: the locked shared-space note, or the amount the chosen months come to. */
export function depositHelperText(
  kind: DepositSpaceKind,
  months: number,
  amount: number,
  formatAmount: (n: number) => string = (n) => `PKR ${n}`,
): string | undefined {
  if (kind === "shared") return SHARED_SPACE_DEPOSIT_HINT;
  if (kind !== "private") return undefined;
  if (!(months > 0)) return `${NO_SECURITY_DEPOSIT}.`;
  if (!(amount > 0)) return `${depositMonthsLabel(months)} of rent after the discount (refundable).`;
  return `${formatAmount(amount)} refundable: ${depositMonthsLabel(months)} of rent after the discount.`;
}
