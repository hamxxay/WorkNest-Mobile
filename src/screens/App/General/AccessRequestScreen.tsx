import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import {
  allowedSpaces,
  saveDoorAccess,
  verifyDoorAccess,
  type DoorAccessDetails,
  type DoorAccessResult,
} from '../../../services/doorAccessService';

type FormState = { name: string; email: string; cnic: string; phone: string };

export default function AccessRequestScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    cnic: '',
    phone: user?.phoneNumber ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  // Set when the details match more than one room: the user picks one, then confirms.
  const [pending, setPending] = useState<{ details: DoorAccessDetails; result: DoorAccessResult } | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const rooms = pending ? allowedSpaces(pending.result) : [];

  // At least two of name, email, CNIC and phone must match the access user added in Sales,
  // one of them CNIC or email.
  const canSubmit = useMemo(
    () =>
      [form.name, form.email, form.cnic, form.phone].filter(v => v.trim()).length >= 2 &&
      !!(form.email.trim() || form.cnic.trim()),
    [form],
  );

  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Changed details mean the rooms found may no longer apply.
    setPending(null);
    setRoomId(null);
  };

  const finish = async (details: DoorAccessDetails, result: DoorAccessResult, bookingDetailId: number) => {
    if (user?.email) await saveDoorAccess(user.email, details, result, bookingDetailId);
    const room = allowedSpaces(result).find(sp => sp.bookingDetailId === bookingDetailId)?.spaceName;
    Alert.alert('Access verified', `${room ? `Room: ${room}. ` : ''}You can now use Open Door from the home screen.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleSubmit = async () => {
    if (pending) {
      if (roomId == null) {
        Alert.alert('Select your room', 'Your details match more than one booking. Choose the room you use.');
        return;
      }
      await finish(pending.details, pending.result, roomId);
      return;
    }
    if (!canSubmit || submitting) {
      Alert.alert('More information needed', 'Fill in at least two of Name, Email, CNIC and Phone, including your CNIC or Email.');
      return;
    }
    const details = {
      name: form.name.trim(),
      email: form.email.trim(),
      cnic: form.cnic.trim(),
      phone: form.phone.trim(),
    };
    setSubmitting(true);
    try {
      const result = await verifyDoorAccess(details);
      const allowed = allowedSpaces(result);
      if (!result.canOpenDoor || allowed.length === 0) {
        Alert.alert(result.matched ? 'Access disabled' : 'No match found', result.message);
      } else if (allowed.length === 1) {
        // One room: selected automatically
        setRoomId(allowed[0].bookingDetailId);
        await finish(details, result, allowed[0].bookingDetailId);
      } else {
        setPending({ details, result });
        setRoomId(null);
      }
    } catch (err) {
      Alert.alert('Could not verify access', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons name="key-outline" size={24} color={colors.white} />
            </View>
            <View>
              <Text style={styles.eyebrow}>ACCESS</Text>
              <Text style={styles.title}>Access Request</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Fill in at least two, including CNIC or Email, as your company registered them</Text>

            <Field
              label="Name"
              placeholder="Enter full name"
              value={form.name}
              onChangeText={value => updateField('name', value)}
            />
            <Field
              label="Email"
              placeholder="Enter email"
              value={form.email}
              onChangeText={value => updateField('email', value)}
              keyboardType="email-address"
            />
            <Field
              label="CNIC / Passport"
              placeholder="Enter CNIC or passport number"
              value={form.cnic}
              onChangeText={value => updateField('cnic', value)}
            />
            <Field
              label="Phone"
              placeholder="Enter phone number"
              value={form.phone}
              onChangeText={value => updateField('phone', value)}
              keyboardType="phone-pad"
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Room / Office No.</Text>
              {rooms.length > 1 ? (
                <View style={[styles.input, styles.pickerWrap, { borderColor: colors.primary, backgroundColor: colors.card }]}>
                  <Picker
                    selectedValue={roomId ?? undefined}
                    onValueChange={value => setRoomId(value == null ? null : Number(value))}
                    mode="dropdown"
                    dropdownIconColor={colors.mutedForeground}
                    style={{ color: colors.foreground }}
                  >
                    <Picker.Item label="Select your room..." value={undefined} color={colors.mutedForeground} />
                    {rooms.map(room => (
                      <Picker.Item key={room.bookingDetailId} label={room.spaceName || `Booking ${room.bookingDetailId}`} value={room.bookingDetailId} />
                    ))}
                  </Picker>
                </View>
              ) : (
                <Text style={[styles.input, styles.readonlyInput, { borderColor: colors.border, color: colors.mutedForeground }]}>
                  Selected automatically after your details match
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting || (pending && roomId == null)) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting || (!!pending && roomId == null)}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>{pending ? 'Confirm Room' : 'Verify Access'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 40,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
      fontWeight: '700',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.7,
      marginTop: 2,
    },
    formCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      color: colors.mutedForeground,
      marginBottom: 12,
    },
    fieldWrap: {
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 8,
    },
    input: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 15,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    pickerWrap: {
      paddingHorizontal: 4,
      paddingVertical: 0,
      justifyContent: 'center',
    },
    readonlyInput: {
      fontSize: 13,
      textAlignVertical: 'center',
    },
    submitBtn: {
      marginTop: 20,
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.55,
    },
    submitText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
    bottomSpace: {
      height: 24,
    },
  });
