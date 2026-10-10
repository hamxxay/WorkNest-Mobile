import RNShare from "react-native-share";
import { downloadMyAgreementPdf } from "../services/agreementService";

/**
 * Downloads the customer's agreement PDF and opens it in the system share / viewer sheet
 * (iOS shows a Quick Look preview with "Open in…"; Android offers PDF viewers, Drive, etc.).
 * Resolves true once the sheet was shown (also when the user just dismisses it);
 * throws with a readable message if the download or the sheet fails.
 */
export async function openAgreementPdf(agreementId: number | string): Promise<boolean> {
  const dataUrl = await downloadMyAgreementPdf(agreementId);
  await RNShare.open({
    url: dataUrl,
    type: "application/pdf",
    filename: `WorkNest-Agreement-${agreementId}`,
    title: `WorkNest Agreement #${agreementId}`,
    failOnCancel: false,
  });
  return true;
}
