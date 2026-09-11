import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import {
  createCustomer,
  normalizeCustomerPayload,
} from '../../../services/customerService';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phoneNumber: '',
  cnicOrPassport: '',
  address: '',
  cityId: '0',
  notes: '',
  isActive: true,
};

export default function CustomerCreateScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    return [
      form.firstName.trim(),
      form.lastName.trim(),
      form.email.trim(),
      form.phoneNumber.trim(),
      form.cnicOrPassport.trim(),
      form.address.trim(),
    ].every(Boolean);
  }, [form]);

  const updateField = (
    field: keyof typeof EMPTY_FORM,
    value: string | boolean,
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Missing fields',
        'Please complete the required customer information.',
      );
      return;
    }

    try {
      setSaving(true);
      const payload = normalizeCustomerPayload({
        ...form,
        cityId: Number(form.cityId || 0),
      });
      await createCustomer(payload);
      Alert.alert(
        'Customer created',
        'The customer has been saved successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create customer.';
      Alert.alert('Create customer failed', message);
    } finally {
      setSaving(false);
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
              <Ionicons
                name="person-add-outline"
                size={24}
                color={colors.white}
              />
            </View>
            <View>
              <Text style={styles.eyebrow}>CUSTOMER</Text>
              <Text style={styles.title}>Create Customer</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Basic Information</Text>

            <Field
              label="First Name*"
              value={form.firstName}
              onChangeText={value => updateField('firstName', value)}
            />
            <Field
              label="Last Name"
              value={form.lastName}
              onChangeText={value => updateField('lastName', value)}
            />
            <Field
              label="Company"
              value={form.company}
              onChangeText={value => updateField('company', value)}
            />
            <Field
              label="Email*"
              value={form.email}
              onChangeText={value => updateField('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Phone Number*"
              value={form.phoneNumber}
              onChangeText={value => updateField('phoneNumber', value)}
              keyboardType="phone-pad"
            />
            <Field
              label="CNIC / Passport"
              value={form.cnicOrPassport}
              onChangeText={value => updateField('cnicOrPassport', value)}
            />
            <Field
              label="Address*"
              value={form.address}
              onChangeText={value => updateField('address', value)}
              multiline
            />
            <Field
              label="City ID"
              value={form.cityId}
              onChangeText={value => updateField('cityId', value)}
              keyboardType="numeric"
            />
            <Field
              label="Notes"
              value={form.notes}
              onChangeText={value => updateField('notes', value)}
              multiline
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <TouchableOpacity
                onPress={() => updateField('isActive', !form.isActive)}
                style={[styles.switch, form.isActive && styles.switchOn]}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.switchThumb,
                    form.isActive && styles.switchThumbOn,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !canSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.submitText}>
              {saving ? 'Saving...' : 'Create Customer'}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}) {
  const colors = useThemeColors();
  const fieldStyles = useThemedStyles(createStyles);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={[
          fieldStyles.input,
          multiline && fieldStyles.textarea,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1 , paddingHorizontal: 18, paddingBottom: 28, gap: 16 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
      fontWeight: '800',
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 46,
    },
    textarea: {
      minHeight: 92,
      textAlignVertical: 'top',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingTop: 8,
    },
    switchLabel: {
      fontWeight: '700',
      color: colors.foreground,
      fontSize: 14,
    },
    switch: {
      width: 52,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.muted,
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchOn: { backgroundColor: colors.primary },
    switchThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.white,
      marginLeft: 0,
    },
    switchThumbOn: {
      marginLeft: 20,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
  });
