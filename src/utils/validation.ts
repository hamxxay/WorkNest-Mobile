export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ALPHANUMERIC_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&#^()_\-+=.]{8,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return ALPHANUMERIC_PASSWORD_REGEX.test(value);
}

export function normalizeCardNumber(value: string): string {
  return value.replace(/\s+/g, "");
}

export function isValidCardNumber(value: string): boolean {
  const digits = normalizeCardNumber(value);
  return /^\d{13,19}$/.test(digits);
}

export function isValidCvv(value: string): boolean {
  return /^\d{3,4}$/.test(value.trim());
}

export function isValidExpiry(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(`20${match[2]}`);
  if (month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const expiryDate = new Date(year, month, 0, 23, 59, 59, 999);
  return expiryDate >= now;
}
 