import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppText,
  BottomSheet,
  Button,
  FieldLabel,
  SegmentedControl,
  SelectField,
  TextField,
} from "../../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../../theme";
import { errorMessage } from "../../../../services/apiClient";
import {
  addBookingEmployee,
  BRANCH_ACCESS_NOTE,
  formatPassportInput,
  NAME_MAX,
  PASSPORT_MAX,
  PENDING_TEXT,
  validateEmployeeForm,
  type EmployeeForm,
  type EmployeeFormErrors,
  type EmployeeFormMode,
  type EmployeeIdType,
  type SavedEmployee,
} from "../../../../services/employeeService";
import { formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput, PHONE_MAX_LENGTH } from "../../../../utils/phone";
import { INPUT_LIMITS } from "../../../../utils/inputSanitizer";

export type AddEmployeeSheetProps = {
  bookingId: number;
  /** People added on the customer's other bookings; the "added before" mode is offered only when there are some. */
  savedEmployees: SavedEmployee[];
  /** Free seats, when known (shown under the title). */
  seatsLeft: number | null;
  onClose: () => void;
  /** Added: called with the API's message (the sheet is closed by the parent). */
  onAdded: (message: string) => void;
  /** The API refused (seats full, same ID...): the parent refreshes the list behind the sheet. */
  onRefused?: () => void;
};

const CNIC_DISPLAY_LENGTH = 15; // 12345-1234567-1
const PENDING_HINT = `Until WorkNest checks their CNIC there, they show as "${PENDING_TEXT}".`;

/**
 * Add an employee to the booking: a new person (full name, optional email and phone, CNIC or passport) or someone
 * the customer added on another booking. Field rules match the API; the API's refusal is shown in the sheet.
 */
export function AddEmployeeSheet({ bookingId, savedEmployees, seatsLeft, onClose, onAdded, onRefused }: AddEmployeeSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasSaved = savedEmployees.length > 0;

  const [mode, setMode] = useState<EmployeeFormMode>("new");
  const [personId, setPersonId] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState<EmployeeIdType>("CNIC");
  const [idNumber, setIdNumber] = useState("");
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // State updates are async: the ref stops a second tap from sending the form twice.
  const savingRef = useRef(false);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const idRef = useRef<TextInput>(null);

  const activeMode: EmployeeFormMode = hasSaved ? mode : "new";

  const clear = (field: keyof EmployeeFormErrors) => {
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
    setError(null);
  };

  const submit = async () => {
    if (savingRef.current) return;
    const form: EmployeeForm =
      activeMode === "existing"
        ? { mode: "existing", personId }
        : { mode: "new", fullName, email, phone, idType, idNumber };
    const invalid = validateEmployeeForm(form);
    setErrors(invalid);
    setError(null);
    if (Object.keys(invalid).length) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await addBookingEmployee(bookingId, form);
      onAdded(result.message);
    } catch (err) {
      setError(errorMessage(err, "The employee could not be added. Please try again."));
      onRefused?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const close = () => {
    if (!savingRef.current) onClose();
  };

  return (
    <BottomSheet
      visible
      onClose={close}
      dismissible={!saving}
      title="Add employee"
      subtitle={seatsLeft !== null ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left on this booking` : undefined}
      error={error}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={close} disabled={saving} style={styles.flex} />
          <Button
            title="Add employee"
            onPress={submit}
            loading={saving}
            disabled={saving}
            haptic
            style={styles.flex}
            accessibilityLabel="Add employee"
          />
        </>
      }
    >
      {hasSaved ? (
        <SegmentedControl
          accessibilityLabel="Who to add"
          value={mode}
          disabled={saving}
          onChange={(v) => {
            setMode(v);
            setErrors({});
            setError(null);
          }}
          options={[
            { label: "New person", value: "new", accessibilityLabel: "Add a new person" },
            { label: "Added before", value: "existing", accessibilityLabel: "Choose someone you added before" },
          ]}
        />
      ) : null}

      {activeMode === "existing" ? (
        <SelectField
          label="Someone you added before"
          required
          value={personId}
          options={savedEmployees.map((p) => ({
            label: p.name,
            value: p.personId,
            description: p.idNumber ? `${p.idType} ${p.idNumber}` : undefined,
          }))}
          onChange={(v) => {
            setPersonId(v);
            clear("personId");
          }}
          placeholder="Choose a person"
          sheetTitle="Choose someone you added before"
          leftIcon="person-outline"
          error={errors.personId}
          disabled={saving}
        />
      ) : (
        <>
          <TextField
            label="Full name"
            required
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              clear("fullName");
            }}
            autoCapitalize="words"
            autoComplete="name"
            maxLength={NAME_MAX}
            leftIcon="person-outline"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.fullName}
            disabled={saving}
          />
          <TextField
            ref={emailRef}
            label="Email"
            helperText="Optional"
            value={email}
            onChangeText={(t) => {
              setEmail(t.trim());
              clear("email");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={INPUT_LIMITS.email}
            leftIcon="mail-outline"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            error={errors.email}
            disabled={saving}
          />
          <TextField
            ref={phoneRef}
            label="Phone"
            helperText="Optional"
            value={phone}
            onChangeText={(t) => {
              setPhone(formatPhoneInput(t));
              clear("phone");
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={PHONE_MAX_LENGTH}
            placeholder="03001234567"
            leftIcon="call-outline"
            returnKeyType="next"
            onSubmitEditing={() => idRef.current?.focus()}
            error={errors.phone}
            disabled={saving}
          />
          <View style={styles.group}>
            <FieldLabel label="ID type" required />
            <SegmentedControl
              accessibilityLabel="ID type"
              value={idType}
              disabled={saving}
              onChange={(v) => {
                setIdType(v);
                setIdNumber("");
                clear("idNumber");
              }}
              options={[
                { label: "CNIC", value: "CNIC" },
                { label: "Passport", value: "Passport" },
              ]}
            />
          </View>
          <TextField
            ref={idRef}
            label={idType === "CNIC" ? "CNIC number" : "Passport number"}
            required
            value={idNumber}
            onChangeText={(t) => {
              setIdNumber(idType === "CNIC" ? formatCnicInput(t) : formatPassportInput(t));
              clear("idNumber");
            }}
            keyboardType={idType === "CNIC" ? "number-pad" : "default"}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={idType === "CNIC" ? CNIC_DISPLAY_LENGTH : PASSPORT_MAX}
            placeholder={idType === "CNIC" ? "12345-1234567-1" : "AB1234567"}
            helperText={idType === "CNIC" ? "13 digits" : "6 to 20 letters and numbers"}
            leftIcon="card-outline"
            returnKeyType="done"
            onSubmitEditing={submit}
            error={errors.idNumber}
            disabled={saving}
          />
        </>
      )}

      <View style={styles.note} accessible accessibilityLabel={`${BRANCH_ACCESS_NOTE} ${PENDING_HINT}`}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted">
            {BRANCH_ACCESS_NOTE}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {PENDING_HINT}
          </AppText>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    group: { gap: t.spacing.xs },
    note: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm, marginTop: t.spacing.xs },
  });
