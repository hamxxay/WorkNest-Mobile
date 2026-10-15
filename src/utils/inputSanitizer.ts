import {
  isValidCardNumber,
  isValidCvv,
  isValidEmail,
  isValidExpiry,
  isValidPassword,
} from "./validation";
import { isValidPhone, PHONE_ERROR } from "./phone";

const MULTI_SPACE_REGEX = /\s+/g;

export const INPUT_LIMITS = {
  email: 254, 
  password: 128,
  name: 80,
  phone: 20,
  message: 100,
  notes: 300,
  search: 80,
  cardHolderName: 80,
  cardNumber: 23,
  cardExpiry: 5,
  cardCvv: 4,
  accountNumber: 34,
  transferReference: 64,
} as const;

function trimToMax(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function removeControls(value: string) {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
}

function collapseWhitespace(value: string) {
  return value.replace(MULTI_SPACE_REGEX, " ").trim();
}

type SoftTextOptions = {
  maxLength: number;
  multiline?: boolean;
  collapse?: boolean;
};

export function sanitizeTextForState(value: string, options: SoftTextOptions): string {
  const withoutControls = removeControls(value);
  const normalized = options.multiline
    ? withoutControls.replace(/\r\n/g, "\n")
    : withoutControls.replace(/\s+/g, " ");
  const nextValue = options.collapse ? collapseWhitespace(normalized) : normalized;
  return trimToMax(nextValue, options.maxLength);
}

function ensurePresent(value: string, fieldLabel: string): string {
  if (!value) {
    throw new Error(`${fieldLabel} is required.`);
  }
  return value;
}

function ensureMaxLength(value: string, fieldLabel: string, maxLength: number): string {
  if (value.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

function ensurePattern(
  value: string,
  fieldLabel: string,
  pattern: RegExp,
  message: string
): string {
  if (!pattern.test(value)) {
    throw new Error(message || `${fieldLabel} is invalid.`);
  }
  return value;
}

export function sanitizeEmailInput(value: string): string {
  const normalized = collapseWhitespace(removeControls(value).toLowerCase());
  ensurePresent(normalized, "Email");
  ensureMaxLength(normalized, "Email", INPUT_LIMITS.email);
  if (!isValidEmail(normalized)) {
    throw new Error("Please enter a valid email address.");
  }
  return normalized;
}

export function sanitizePasswordInput(value: string): string {
  const normalized = removeControls(value).trim();
  ensurePresent(normalized, "Password");
  ensureMaxLength(normalized, "Password", INPUT_LIMITS.password);
  if (!isValidPassword(normalized)) {
    throw new Error("Password must be at least 8 characters and include letters and numbers.");
  }
  return normalized;
}

/**
 * Sign-in password: used exactly as typed (spaces, commas, any symbol), only checked for being present. The
 * strength rule above (sanitizePasswordInput) is for new passwords only: accounts made on the website or in the
 * CMS can have any password Firebase accepts.
 */
export function sanitizeLoginPasswordInput(value: string): string {
  const password = typeof value === "string" ? value : "";
  if (!password) {
    throw new Error("Enter your password.");
  }
  return password;
}

/** Password field state: kept as typed (no whitespace folding), only capped at the field limit. */
export function passwordForState(value: string): string {
  return trimToMax(typeof value === "string" ? value : "", INPUT_LIMITS.password);
}

/**
 * A person's name: letters of any language (Unicode letters and their accents, e.g. "Zoë", "Muñoz", "محمد علی"),
 * spaces, apostrophes (' and ’), periods and hyphens; it starts with a letter and ends with a letter or a period.
 */
const NAME_PATTERN = /^[\p{L}\p{M}](?:[\p{L}\p{M} '\u2019.-]*[\p{L}\p{M}.])?$/u;

/** While typing: only characters a name may have (it may still end with a space or hyphen). */
const NAME_TYPING_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '\u2019.-]*$/u;

/**
 * Why a name can't be used, or null when it is fine, for a message under the field. `typing: true` (on every key)
 * only flags characters a name can't have; the full check (empty, too short, how it ends) runs on leaving the field
 * and on submit.
 */
export function nameError(
  value: string,
  fieldLabel = "Name",
  options: { required?: boolean; typing?: boolean } = {},
): string | null {
  const normalized = collapseWhitespace(removeControls(value ?? ""));
  const invalid = `${fieldLabel} can only have letters, spaces, apostrophes, periods and hyphens.`;
  if (options.typing) return normalized && !NAME_TYPING_PATTERN.test(normalized) ? invalid : null;
  if (!normalized) return options.required === false ? null : `Enter your ${fieldLabel.toLowerCase()}.`;
  if (normalized.length < 2) return `Enter your ${fieldLabel.toLowerCase()}.`;
  if (normalized.length > INPUT_LIMITS.name) return `${fieldLabel} must be ${INPUT_LIMITS.name} characters or fewer.`;
  return NAME_PATTERN.test(normalized) ? null : invalid;
}

export function sanitizeNameInput(value: string, fieldLabel = "Name"): string {
  const normalized = collapseWhitespace(removeControls(value));
  ensurePresent(normalized, fieldLabel);
  ensureMaxLength(normalized, fieldLabel, INPUT_LIMITS.name);
  return ensurePattern(
    normalized,
    fieldLabel,
    NAME_PATTERN,
    `${fieldLabel} can only have letters, spaces, apostrophes, periods and hyphens.`
  );
}

export function sanitizeOptionalNameInput(value?: string | null): string | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }
  return sanitizeNameInput(value);
}

export function sanitizePhoneInput(value: string, fieldLabel = "Phone number"): string {
  const compact = removeControls(value).trim();
  ensurePresent(compact, fieldLabel);
  ensureMaxLength(compact, fieldLabel, INPUT_LIMITS.phone);
  if (!isValidPhone(compact)) {
    throw new Error(PHONE_ERROR);
  }
  return compact.replace(/\s+/g, " ");
}

export function sanitizeMessageInput(value: string, fieldLabel = "Message"): string {
  const normalized = sanitizeTextForState(value, {
    maxLength: INPUT_LIMITS.message,
    multiline: true,
  }).trim();
  ensurePresent(normalized, fieldLabel);
  ensureMaxLength(normalized, fieldLabel, INPUT_LIMITS.message);
  return normalized;
}

export function sanitizeNotesInput(value: string): string {
  const normalized = sanitizeTextForState(value, {
    maxLength: INPUT_LIMITS.notes,
    multiline: true,
  }).trim();
  ensureMaxLength(normalized, "Notes", INPUT_LIMITS.notes);
  return normalized;
}

export function sanitizeSearchInput(value: string): string {
  const normalized = collapseWhitespace(removeControls(value));
  ensureMaxLength(normalized, "Search", INPUT_LIMITS.search);
  return normalized;
}

export function sanitizeCardHolderName(value: string): string {
  return sanitizeNameInput(value, "Card holder name");
}

export function sanitizeCardNumberInput(value: string): string {
  const normalized = removeControls(value).replace(/\s+/g, "");
  ensurePresent(normalized, "Card number");
  ensureMaxLength(normalized, "Card number", 19);
  if (!isValidCardNumber(normalized)) {
    throw new Error("Please enter a valid card number.");
  }
  return normalized;
}

export function sanitizeCardExpiryInput(value: string): string {
  const normalized = removeControls(value).trim();
  ensurePresent(normalized, "Card expiry");
  ensureMaxLength(normalized, "Card expiry", INPUT_LIMITS.cardExpiry);
  if (!isValidExpiry(normalized)) {
    throw new Error("Please enter a valid expiry date in MM/YY format.");
  }
  return normalized;
}

export function sanitizeCardCvvInput(value: string): string {
  const normalized = removeControls(value).trim();
  ensurePresent(normalized, "Card CVV");
  ensureMaxLength(normalized, "Card CVV", INPUT_LIMITS.cardCvv);
  if (!isValidCvv(normalized)) {
    throw new Error("Please enter a valid CVV.");
  }
  return normalized;
}

export function sanitizeAccountNumberInput(value: string, fieldLabel = "Account number"): string {
  const normalized = removeControls(value).trim().toUpperCase();
  ensurePresent(normalized, fieldLabel);
  ensureMaxLength(normalized, fieldLabel, INPUT_LIMITS.accountNumber);
  return ensurePattern(
    normalized,
    fieldLabel,
    /^[A-Z0-9\- ]+$/,
    `${fieldLabel} contains invalid characters.`
  );
}

export function sanitizeTransferReferenceInput(value: string): string {
  const normalized = collapseWhitespace(removeControls(value).toUpperCase());
  ensurePresent(normalized, "Transfer reference");
  ensureMaxLength(normalized, "Transfer reference", INPUT_LIMITS.transferReference);
  return ensurePattern(
    normalized,
    "Transfer reference",
    /^[A-Z0-9._\-/ ]+$/,
    "Transfer reference contains invalid characters."
  );
}
