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
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors, useThemedStyles } from '../../../theme';

const EMPTY_FORM = {
  name: '',
  cnic: '',
  phone: '',
  companyName: '',
  roomOrConferenceNo: '',
};

export default function AccessRequestScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(
    () =>
      [form.name.trim(), form.cnic.trim(), form.phone.trim(), form.companyName.trim()].every(Boolean),
    [form],
  );

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert(
        'Required information missing',
        'Please fill in Name, CNIC, Phone, and Company Name.',
      );
      return;
    }

    Alert.alert(
      'Access request submitted',
      'Your access request has been received successfully.',
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
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
            <Text style={styles.sectionLabel}>Required information</Text>

            <Field
              label="Name *"
              placeholder="Enter full name"
              value={form.name}
              onChangeText={value => updateField('name', value)}
            />
            <Field
              label="CNIC *"
              placeholder="Enter CNIC number"
              value={form.cnic}
              onChangeText={value => updateField('cnic', value)}
            />
            <Field
              label="Phone *"
              placeholder="Enter phone number"
              value={form.phone}
              onChangeText={value => updateField('phone', value)}
              keyboardType="phone-pad"
            />
            <Field
              label="Company Name *"
              placeholder="Enter company name"
              value={form.companyName}
              onChangeText={value => updateField('companyName', value)}
            />
            <Field
              label="Room / Conference No (Optional)"
              placeholder="Optional"
              value={form.roomOrConferenceNo}
              onChangeText={value => updateField('roomOrConferenceNo', value)}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.submitText}>Submit Request</Text>
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
