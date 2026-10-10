import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors, useThemedStyles } from '../theme';
import {
  saveInquiryFeedback,
  type InquiryOutcome,
  type TourInquiry,
} from '../services/contactService';
import {
  addDaysYmd,
  addMonthsYmd,
  formatYmd,
  parseYmd,
  toYmd,
  todayYmd,
} from '../utils/inquiry';

const OPTIONS: { key: InquiryOutcome; label: string; hint: string; icon: string }[] = [
  {
    key: 'not_interested',
    label: 'Not interested',
    hint: 'Enter the reason. The inquiry is closed.',
    icon: 'close-circle-outline',
  },
  {
    key: 'future_prospect',
    label: 'Future prospect',
    hint: 'Choose the follow-up date. You will be alerted on that date.',
    icon: 'time-outline',
  },
  {
    key: 'converted',
    label: 'Conversion into quotation',
    hint: 'Opens Create Quotation for this customer. The inquiry is marked converted when the quotation is saved.',
    icon: 'document-text-outline',
  },
];

const QUICK_PICKS = [
  { label: 'Tomorrow', value: () => addDaysYmd(1) },
  { label: 'In 3 days', value: () => addDaysYmd(3) },
  { label: 'Next week', value: () => addDaysYmd(7) },
  { label: 'In 2 weeks', value: () => addDaysYmd(14) },
  { label: 'In a month', value: () => addMonthsYmd(1) },
];

type Props = {
  visible: boolean;
  inquiry: TourInquiry | null;
  onClose: () => void;
  /** Feedback saved (not interested / future prospect): the API's message. */
  onSaved: (message: string) => void;
  /** "Conversion into quotation" chosen: open Create Quotation for this inquiry. */
  onConvert: (inquiry: TourInquiry) => void;
};

/** Feedback on a tour inquiry — the same three options as the website's Tour Inquiries page. */
export function InquiryFeedbackSheet({ visible, inquiry, onClose, onSaved, onConvert }: Props) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [outcome, setOutcome] = useState<InquiryOutcome | ''>('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setOutcome('');
      setReason('');
      setDate('');
      setShowPicker(false);
      setError('');
    }
  }, [visible, inquiry]);

  const close = () => {
    if (savingRef.current) return;
    onClose();
  };

  const save = async () => {
    if (savingRef.current || !inquiry) return;
    if (!outcome) {
      setError('Choose an option.');
      return;
    }
    if (outcome === 'converted') {
      onConvert(inquiry);
      return;
    }
    if (outcome === 'not_interested' && !reason.trim()) {
      setError('Enter the reason.');
      return;
    }
    if (outcome === 'future_prospect') {
      const picked = parseYmd(date);
      if (!date.trim()) {
        setError('Choose the follow-up date.');
        return;
      }
      if (!picked) {
        setError('Enter the date as yyyy-MM-dd, e.g. ' + addDaysYmd(1) + '.');
        return;
      }
      if (toYmd(picked) < todayYmd()) {
        setError('The follow-up date cannot be in the past.');
        return;
      }
    }

    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const message = await saveInquiryFeedback(inquiry, {
        outcome,
        reason: reason.trim() || null,
        followUpOn: outcome === 'future_prospect' ? date.trim() : null,
      });
      onSaved(
        outcome === 'not_interested'
          ? `${message} Marked not interested and closed.`
          : `${message} You will be alerted on ${formatYmd(date.trim())}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the feedback.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const pickerValue = parseYmd(date) ?? parseYmd(addDaysYmd(1)) ?? new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>FEEDBACK</Text>
              <Text style={styles.title} numberOfLines={1}>
                {inquiry?.fullName || 'Tour inquiry'}
              </Text>
            </View>
            <Pressable hitSlop={10} onPress={close} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {OPTIONS.map(option => {
              const selected = outcome === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    setOutcome(option.key);
                    setError('');
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionHint}>{option.hint}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
              );
            })}

            {outcome === 'not_interested' ? (
              <View>
                <Text style={styles.label}>Reason *</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why is the customer not interested?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={1000}
                  style={[styles.input, styles.textarea]}
                />
              </View>
            ) : null}

            {outcome === 'future_prospect' ? (
              <View>
                <Text style={styles.label}>Follow-up date *</Text>
                <View style={styles.chips}>
                  {QUICK_PICKS.map(pick => {
                    const value = pick.value();
                    const active = date === value;
                    return (
                      <Pressable
                        key={pick.label}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => {
                          setDate(value);
                          setError('');
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {pick.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.dateRow}>
                  <TextInput
                    value={date}
                    onChangeText={value => {
                      setDate(value.replace(/[^0-9-]/g, '').slice(0, 10));
                      setError('');
                    }}
                    placeholder="yyyy-MM-dd"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                    style={[styles.input, styles.flex]}
                  />
                  <Pressable
                    style={styles.calendarBtn}
                    accessibilityLabel="Pick a date"
                    onPress={() => setShowPicker(prev => !prev)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </Pressable>
                </View>
                {parseYmd(date) ? (
                  <Text style={styles.optionHint}>Follow up on {formatYmd(date)}</Text>
                ) : null}
                {showPicker ? (
                  <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    minimumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    accentColor={colors.primary}
                    onChange={(event, picked) => {
                      if (Platform.OS === 'android') setShowPicker(false);
                      if (event.type === 'set' && picked) {
                        setDate(toYmd(picked));
                        setError('');
                      }
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={close} disabled={saving}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, (saving || !outcome) && styles.disabled]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryText}>
                    {outcome === 'converted' ? 'Create quotation' : 'Save'}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 24,
      maxHeight: '90%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, color: colors.mutedForeground, fontWeight: '700' },
    title: { fontSize: 20, fontWeight: '800', color: colors.foreground, marginTop: 2 },
    body: { gap: 12, paddingBottom: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      backgroundColor: colors.card,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.accentMuted },
    optionLabel: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    optionHint: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, lineHeight: 17 },
    label: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 46,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
    textarea: { minHeight: 92, textAlignVertical: 'top' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.muted,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    chipTextActive: { color: colors.white },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    calendarBtn: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: { fontSize: 14, fontWeight: '600', color: colors.danger },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    primaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    disabled: { opacity: 0.55 },
  });
