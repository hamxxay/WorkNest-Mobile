import { Platform, type TextStyle, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { ApiError } from "./apiClient";

// Signatures for e-signing an agreement (POST /Agreement/my/{id}/esign), drawn or typed like the website's
// e-sign panel. Either way the screen renders the signature in a white box and this service turns that box
// into the PNG the API expects ("data:image/png;base64,...", at most 300 KB).

/** The API's limit for the signature image (AgreementController.MaxSignatureImageBytes). */
export const MAX_SIGNATURE_BYTES = 300 * 1024;

/** The signature box is a document: always white with dark ink, also in dark mode. */
export const SIGNATURE_BACKGROUND = "#FFFFFF";
export const SIGNATURE_INK = "#0A1628";

/**
 * Text style for a typed signature: a handwriting font (Android's built-in "cursive"), dark ink.
 * Render the typed name with it inside the signature box, then capture the box.
 */
export const TYPED_SIGNATURE_TEXT_STYLE: TextStyle = {
  fontFamily: Platform.select({ android: "cursive", ios: "Snell Roundhand", default: undefined }),
  fontSize: 44,
  color: SIGNATURE_INK,
  textAlign: "center",
};

/** Message for an invalid signer name / typed signature (the API wants 2 to 100 characters), or null. */
export function signerNameError(name: string): string | null {
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 2 || trimmed.length > 100) return "Enter your full name (2 to 100 characters).";
  return null;
}

/** "data:image/png;base64,..." from a captured PNG, refusing images the API would reject as too large. */
export function signatureDataUrl(base64: string): string {
  const clean = (base64 ?? "").replace(/^data:image\/png;base64,/, "").trim();
  if (!clean) throw new ApiError("Could not capture your signature. Please try again.", 0);
  if (clean.length * 0.75 > MAX_SIGNATURE_BYTES) {
    throw new ApiError("Your signature image is too large. Clear it and sign again.", 0);
  }
  return `data:image/png;base64,${clean}`;
}

/**
 * Captures the signature box (drawn strokes or the typed name) as a PNG data URL for eSignMyAgreement.
 * Throws a readable ApiError when the capture fails or the image is too large.
 */
export async function captureSignatureImage(
  ref: { current: View | null },
  width = 600,
): Promise<string> {
  let base64: string;
  try {
    base64 = await captureRef(ref, { format: "png", quality: 1, result: "base64", width });
  } catch {
    throw new ApiError("Could not capture your signature. Please try again.", 0);
  }
  return signatureDataUrl(base64);
}
