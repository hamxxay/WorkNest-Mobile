// The amount breakdown the API sends with a challan or a quotation (`fields`: [{ key, label, value, isHeader }]).
// It is the same breakdown the challan / quotation PDF prints, already formatted by the API ("PKR 297,500"), and
// its amount rows add up to the total payable: advance rent - discount + tax + security deposit. The ledger lines
// (`details`) are accounting entries and do not add up to the total, so screens show these fields instead.
//
// Keys the API sends (ChallanCalculationService.BuildFields):
//   header rows   spaceNo, spaceName (isHeader: true)
//   terms         contractPeriod, startDateTime, endDateTime, duration, billingBasis, billingPeriod,
//                 advanceRentPeriod, monthlyRent, supportCharge (already inside the rent), whtRate
//   amounts       advanceRent / rentAmount, securityDeposit, tax, discount (subtracted)
//   total         totalAmount
//   after total   whtAmount, netPayable (withholding tax invoices only)

export type BreakdownField = {
  key: string;
  label: string;
  value: string;
  isHeader: boolean;
};

export type AmountBreakdown = {
  /** Period, billing and rate rows (information, not added up). */
  terms: BreakdownField[];
  /** Rows that add up to the total, in the API's order. A discount's value carries a leading minus. */
  amounts: BreakdownField[];
  /** The API's total row (TOTAL INITIAL AMOUNT PAYABLE), when sent. */
  total: BreakdownField | null;
  /** Rows after the total (withholding tax and the net payable). */
  afterTotal: BreakdownField[];
};

const AMOUNT_KEYS = new Set(["advancerent", "rentamount", "securitydeposit", "tax", "discount"]);
const TOTAL_KEYS = new Set(["totalamount", "totalpayable"]);
const AFTER_TOTAL_KEYS = new Set(["whtamount", "netpayable"]);

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());

/** `fields` / `Fields` of a challan or quotation payload; rows without a label or value are dropped. */
export function normalizeBreakdownFields(raw: unknown): BreakdownField[] {
  const source = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(source.fields) ? source.fields : Array.isArray(source.Fields) ? source.Fields : [];
  return list
    .map((item: unknown) => {
      const f = (item ?? {}) as Record<string, unknown>;
      return {
        key: text(f.key ?? f.Key),
        label: text(f.label ?? f.Label),
        value: text(f.value ?? f.Value),
        isHeader: (f.isHeader ?? f.IsHeader) === true,
      };
    })
    .filter((f) => f.label && f.value);
}

const keyOf = (field: BreakdownField) => field.key.toLowerCase();

/** Splits the API's fields into terms, the rows that add up, the total and the rows after it. Header rows are left out. */
export function splitBreakdown(fields: BreakdownField[]): AmountBreakdown {
  const result: AmountBreakdown = { terms: [], amounts: [], total: null, afterTotal: [] };
  for (const field of fields) {
    if (field.isHeader) continue;
    const key = keyOf(field);
    if (TOTAL_KEYS.has(key)) {
      result.total = result.total ?? field;
    } else if (AFTER_TOTAL_KEYS.has(key)) {
      result.afterTotal.push(field);
    } else if (AMOUNT_KEYS.has(key)) {
      const isDiscount = key === "discount" && !field.value.startsWith("-");
      result.amounts.push(isDiscount ? { ...field, value: `- ${field.value}` } : field);
    } else {
      result.terms.push(field);
    }
  }
  return result;
}

/** The value of one field by key (e.g. "advanceRentPeriod" -> "3 Months"), or null. */
export function breakdownValue(fields: BreakdownField[], key: string): string | null {
  const wanted = key.toLowerCase();
  return fields.find((f) => keyOf(f) === wanted)?.value || null;
}

/** "3 Months" / "1 Month" for a whole number of months, else null. */
export function monthsLabel(months: number | null | undefined): string | null {
  if (months === null || months === undefined || !Number.isFinite(months) || months <= 0) return null;
  const n = Math.round(months);
  return `${n} ${n === 1 ? "month" : "months"}`;
}
