import { openMyAgreementPdf } from "../services/agreementService";

/**
 * Downloads the customer's agreement PDF with the sign-in token and opens it in the system share / viewer
 * sheet (Android offers PDF viewers, Drive, Files, print). Resolves true once the sheet was shown (also when
 * the user just dismisses it); throws with a readable message if the download or the sheet fails.
 */
export async function openAgreementPdf(agreementId: number | string): Promise<boolean> {
  await openMyAgreementPdf(agreementId);
  return true;
}
