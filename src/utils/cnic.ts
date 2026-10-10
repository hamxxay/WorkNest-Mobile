// CNIC rule shared with the API and web: strip spaces and dashes, the rest must be exactly 13 digits.
export const CNIC_ERROR = "CNIC must be 13 digits (numbers only), e.g. 35202-1234567-1.";

export function isValidCnic(value: string): boolean {
  return /^\d{13}$/.test((value ?? "").replace(/[\s-]/g, ""));
}

/** Error message for a non-empty invalid CNIC; null when valid or empty (callers enforce "required"). */
export function cnicError(value: string): string | null {
  if (!(value ?? "").trim()) return null;
  return isValidCnic(value) ? null : CNIC_ERROR;
}

/** Keeps digits only (max 13) and inserts dashes as 5-7-1 while typing: 35202-1234567-1. */
export function formatCnicInput(text: string): string {
  const digits = (text ?? "").replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
