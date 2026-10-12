import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  DateField,
  Divider,
  EmptyState,
  InfoRow,
  SectionHeader,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import {
  extendChallanValidity,
  isValidChallanQuery,
  parseApiDate,
  searchChallan,
  toApiDate,
  type ChallanSearchResult,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";

/**
 * Challan validity (super admin, as in the CMS): find a booking's challan by booking id, challan number or
 * payment voucher number (GET challan/search?q=) and move its expiry date (POST challan/extend-validity). The new
 * date must be after the current expiry and not in the past; it also moves the challan-based door suspension.
 */
export default function ChallanValidityScreen() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ChallanSearchResult | null | undefined>(undefined);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [remarks, setRemarks] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const search = async () => {
    const q = query.trim();
    if (!q) return setQueryError("Enter a booking number or challan number.");
    if (!isValidChallanQuery(q)) return setQueryError("Use letters, digits and dashes only.");
    setQueryError(null);
    setSearching(true);
    setNewDate(null);
    setRemarks("");
    try {
      setResult(await searchChallan(q));
    } catch (err) {
      setResult(undefined);
      toast.error(errorMessage(err, "Could not search for the challan."));
    } finally {
      setSearching(false);
    }
  };

  const current = result?.currentExpiryDate ? parseApiDate(result.currentExpiryDate) : null;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const minDate = current && current >= today ? new Date(current.getTime() + 86400000) : today;

  const extend = async () => {
    if (!result?.bookingId) return;
    if (!newDate) return setDateError("Choose the new expiry date.");
    setDateError(null);
    setSaving(true);
    try {
      const res = await extendChallanValidity({
        bookingId: result.bookingId,
        newExpiryDate: toApiDate(newDate),
        currentExpiryDate: result.currentExpiryDate,
        remarks,
      });
      toast.success(res.message);
      setResult({ ...result, currentExpiryDate: res.data.newExpiryDate, currentExpiryText: res.data.newExpiryDate });
      setNewDate(null);
      setRemarks("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not extend the challan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title="Challan validity" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={styles.form}>
              <TextField
                label="Booking or challan number"
                required
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  if (queryError) setQueryError(null);
                }}
                error={queryError}
                leftIcon="search"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={50}
                returnKeyType="search"
                onSubmitEditing={search}
                helperText="Booking id, booking challan number or payment voucher number"
              />
              <Button title="Find challan" leftIcon="search" onPress={search} loading={searching} />
            </View>
          </Card>

          {result === null ? (
            <EmptyState illustration="search" title="No challan found" message="Check the number and try again." />
          ) : result ? (
            <>
              <SectionHeader title="Challan" variant="overline" />
              <Card>
                <View style={styles.row}>
                  <AppText variant="heading" style={styles.flex}>
                    {result.customerName || "Customer"}
                  </AppText>
                  {result.bookingStatus ? <StatusPill status={result.bookingStatus} /> : null}
                </View>
                <Divider spacing={8} />
                {result.bookingId ? <InfoRow label="Booking" value={`#${result.bookingId}`} /> : null}
                {result.challanNumber ? <InfoRow label="Challan" value={result.challanNumber} /> : null}
                {result.voucherNumber ? <InfoRow label="Voucher" value={result.voucherNumber} /> : null}
                {result.consumerNumber ? <InfoRow label="Consumer no." value={result.consumerNumber} /> : null}
                {result.spaceName ? <InfoRow label="Space" value={result.spaceName} /> : null}
                {result.voucherStatus ? <InfoRow label="Voucher status" value={<StatusPill status={result.voucherStatus} />} /> : null}
                <InfoRow
                  label="Valid until"
                  value={result.currentExpiryDate ? formatDate(result.currentExpiryDate) : result.currentExpiryText ?? "—"}
                  emphasize
                />
              </Card>

              {result.bookingId ? (
                <>
                  <SectionHeader title="Extend validity" variant="overline" />
                  <Card>
                    <View style={styles.form}>
                      <DateField
                        label="New expiry date"
                        required
                        value={newDate}
                        onChange={(d) => {
                          setNewDate(d);
                          setDateError(null);
                        }}
                        minimumDate={minDate}
                        error={dateError}
                        helperText="After the current expiry and not in the past."
                      />
                      <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline rows={2} maxLength={500} />
                      <Button title="Extend validity" leftIcon="time-outline" onPress={extend} loading={saving} disabled={saving} />
                    </View>
                  </Card>
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
