import { optNum, pick, unwrapEnvelope } from "../staff/normalize";

// JSON readers shared by the CEO and Sales Manager normalisers (pure). Not in the services/ceo barrel: import them
// from "../ceo/readers".

export type Row = Record<string, any>;

export const isObject = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);

/** The payload inside the envelope as an object ({} for anything else). */
export function payload(raw: unknown): Row {
  const inner = unwrapEnvelope<unknown>(raw);
  return isObject(inner) ? inner : {};
}

/** The object at `key`, or null when missing / not an object. */
export function section(raw: Row, key: string): Row | null {
  const value = pick(raw, key);
  return isObject(value) ? value : null;
}

/** Rows of the list at `key` (objects only), mapped; [] when missing. */
export function list<T>(raw: Row | null, key: string, map: (row: Row) => T): T[] {
  const value = raw ? pick(raw, key) : undefined;
  return Array.isArray(value) ? value.filter(isObject).map(map) : [];
}

/** A positive int id, or null. */
export function optId(row: Row, ...keys: string[]): number | null {
  const n = optNum(row, ...keys);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

/** Sorted by the yyyy-MM `month` key, oldest first (rows without a month keep their place at the end). */
export function byMonth<T extends { month: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (!a.row.month || !b.row.month) return a.row.month ? -1 : b.row.month ? 1 : a.index - b.index;
      return a.row.month < b.row.month ? -1 : a.row.month > b.row.month ? 1 : a.index - b.index;
    })
    .map((x) => x.row);
}
