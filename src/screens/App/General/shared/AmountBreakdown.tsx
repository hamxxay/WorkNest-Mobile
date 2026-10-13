import { Card, Divider, InfoRow, SectionHeader } from "../../../../components/ui";
import { splitBreakdown, type BreakdownField } from "../../../../services/amountBreakdown";

type Props = {
  /** The API's `fields` of a challan or quotation. */
  fields: BreakdownField[];
  /** Total row label. Default "Total payable". */
  totalLabel?: string;
  /** The total as a formatted amount (from the API's number); defaults to the API's total row value. */
  totalValue?: string;
  /** Title of the period / rate card. Default "Terms". */
  termsTitle?: string;
};

/**
 * The challan / quotation breakdown exactly as the API (and its PDF) gives it: the terms (period, billing, advance
 * period, monthly rent) and the amounts that add up to the total payable (advance rent, security deposit, tax,
 * minus any discount). Renders nothing when there are no amount rows; callers then show their own fallback.
 */
export function AmountBreakdown({ fields, totalLabel = "Total payable", totalValue, termsTitle = "Terms" }: Props) {
  const { terms, amounts, total, afterTotal } = splitBreakdown(fields);
  if (amounts.length === 0 && !total) return null;
  return (
    <>
      {terms.length > 0 ? (
        <>
          <SectionHeader title={termsTitle} />
          <Card>
            {terms.map((field, i) => (
              <InfoRow key={`${field.key || field.label}-${i}`} label={field.label} value={field.value} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Amount breakdown" />
      <Card>
        {amounts.map((field, i) => (
          <InfoRow key={`${field.key || field.label}-${i}`} label={field.label} value={field.value} />
        ))}
        {amounts.length > 0 ? <Divider spacing={8} /> : null}
        <InfoRow label={totalLabel} value={totalValue ?? total?.value} emphasize />
        {afterTotal.map((field, i) => (
          <InfoRow key={`${field.key || field.label}-${i}`} label={field.label} value={field.value} />
        ))}
      </Card>
    </>
  );
}
