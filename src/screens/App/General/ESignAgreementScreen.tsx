import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { eSignMyAgreement } from '../../../services/agreementService';
import { openAgreementPdf } from '../../../utils/openAgreementPdf';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ESignAgreement'>;

/** The signature box is a document: always white with dark ink, also in dark mode. */
const PAD_BACKGROUND = '#FFFFFF';
const PAD_INK = '#0A1628';
const PAD_HEIGHT = 200;
const MAX_SIGNATURE_BYTES = 300 * 1024;
const CONSENT_TEXT =
  'I have read the agreement and agree to sign it electronically. My electronic signature has the same effect as a handwritten one.';

type Point = { x: number; y: number };

function toPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const fx = first.x.toFixed(1);
  const fy = first.y.toFixed(1);
  // A tap is a dot: a tiny segment drawn with round caps.
  if (rest.length === 0) return `M${fx} ${fy} L${(first.x + 0.1).toFixed(1)} ${fy}`;
  return `M${fx} ${fy}` + rest.map(p => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}

/**
 * E-sign a lease agreement: view the PDF, enter the signer's name, draw a signature,
 * agree to sign electronically, then POST it to /Agreement/my/{id}/esign.
 */
export default function ESignAgreementScreen({ navigation, route }: Props) {
  const { agreementId, quotationNumber, customerName } = route.params;
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();

  const [signerName, setSignerName] = useState<string>(() => (user?.name ?? customerName ?? '').trim());
  const [consent, setConsent] = useState(false);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentStroke, setCurrentStroke] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const padRef = useRef<View>(null);
  const pointsRef = useRef<Point[]>([]);
  const padSize = useRef({ width: 0, height: PAD_HEIGHT });
  const submittingRef = useRef(false);

  const trimmedName = signerName.trim();
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 100;
  const hasSignature = strokes.length > 0;
  const canSign = nameValid && hasSignature && consent && !submitting;

  // ── PDF ────────────────────────────────────────────────────────────────────
  const onViewAgreement = async () => {
    if (opening) return;
    setOpening(true);
    setPdfError(null);
    try {
      await openAgreementPdf(agreementId);
      setViewed(true);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not open the agreement. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  // ── Signature pad ──────────────────────────────────────────────────────────
  const clamp = (p: Point): Point => ({
    x: Math.max(0, Math.min(padSize.current.width || p.x, p.x)),
    y: Math.max(0, Math.min(padSize.current.height, p.y)),
  });

  const startStroke = (x: number, y: number) => {
    pointsRef.current = [clamp({ x, y })];
    setCurrentStroke(toPath(pointsRef.current));
    setDrawing(true);
    setError(null);
  };

  const extendStroke = (x: number, y: number) => {
    if (pointsRef.current.length === 0) return;
    const p = clamp({ x, y });
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (Math.abs(p.x - last.x) < 0.8 && Math.abs(p.y - last.y) < 0.8) return;
    pointsRef.current.push(p);
    setCurrentStroke(toPath(pointsRef.current));
  };

  const endStroke = () => {
    const path = toPath(pointsRef.current);
    pointsRef.current = [];
    if (path) setStrokes(prev => [...prev, path]);
    setCurrentStroke('');
    setDrawing(false);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin(e => startStroke(e.x, e.y))
    .onUpdate(e => extendStroke(e.x, e.y))
    .onFinalize(() => endStroke());

  const onPadLayout = (e: LayoutChangeEvent) => {
    padSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  };

  const clearPad = () => {
    pointsRef.current = [];
    setStrokes([]);
    setCurrentStroke('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSign = async () => {
    if (!canSign || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      let base64: string;
      try {
        base64 = await captureRef(padRef, { format: 'png', quality: 1, result: 'base64', width: 600 });
      } catch {
        throw new Error('Could not capture your signature. Please try again.');
      }
      if (!base64) throw new Error('Could not capture your signature. Please try again.');
      if (base64.length * 0.75 > MAX_SIGNATURE_BYTES) {
        throw new Error('Your signature image is too large. Clear it and sign again with a simpler signature.');
      }

      const result = await eSignMyAgreement(agreementId, {
        signerName: trimmedName,
        signatureImage: `data:image/png;base64,${base64}`,
        consent: true,
      });

      Alert.alert(
        result.completed ? 'Agreement signed' : 'Signature received',
        result.message,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
        { cancelable: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not complete your signature. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawing}
      >
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="create-outline" size={24} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>AGREEMENT #{agreementId}</Text>
            <Text style={styles.title}>Sign Agreement</Text>
            {quotationNumber ? <Text style={styles.subtitle}>Quotation: {quotationNumber}</Text> : null}
          </View>
        </View>

        {/* 1. View agreement */}
        <View style={styles.card}>
          <Text style={styles.stepLabel}>1. Read the agreement</Text>
          <Text style={styles.muted}>
            Open the agreement and read it before you sign. It opens in your phone's viewer / share sheet.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View agreement PDF"
            style={[styles.secondaryBtn, opening && styles.disabled]}
            disabled={opening}
            onPress={onViewAgreement}
          >
            {opening ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name={viewed ? 'checkmark-circle' : 'document-text-outline'} size={18} color={viewed ? colors.success : colors.primary} />
                <Text style={styles.secondaryText}>{viewed ? 'Agreement opened — view again' : 'View agreement (PDF)'}</Text>
              </>
            )}
          </Pressable>
          {pdfError ? <Text style={styles.errorInline}>{pdfError}</Text> : null}
        </View>

        {/* 2. Name */}
        <View style={styles.card}>
          <Text style={styles.stepLabel}>2. Your full name</Text>
          <TextInput
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={100}
            editable={!submitting}
            style={[styles.input, { borderColor: signerName && !nameValid ? colors.danger : colors.border }]}
          />
          {signerName && !nameValid ? (
            <Text style={styles.errorInline}>Enter your full name (2 to 100 characters).</Text>
          ) : null}
        </View>

        {/* 3. Signature */}
        <View style={styles.card}>
          <View style={styles.padHeader}>
            <Text style={styles.stepLabel}>3. Draw your signature</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear signature"
              hitSlop={8}
              disabled={!hasSignature || submitting}
              onPress={clearPad}
              style={(!hasSignature || submitting) && styles.disabled}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <GestureDetector gesture={pan}>
            <View
              ref={padRef}
              collapsable={false}
              onLayout={onPadLayout}
              style={styles.pad}
              accessibilityLabel="Signature pad. Draw your signature with your finger."
            >
              <Svg width="100%" height="100%">
                {strokes.map((d, i) => (
                  <Path key={i} d={d} stroke={PAD_INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ))}
                {currentStroke ? (
                  <Path d={currentStroke} stroke={PAD_INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ) : null}
              </Svg>
            </View>
          </GestureDetector>
          {!hasSignature && !currentStroke ? (
            <Text style={styles.muted}>Sign inside the white box with your finger.</Text>
          ) : null}
        </View>

        {/* 4. Consent */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          disabled={submitting}
          onPress={() => setConsent(c => !c)}
          style={styles.consentRow}
        >
          <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={consent ? colors.primary : colors.mutedForeground} />
          <Text style={styles.consentText}>{CONSENT_TEXT}</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign agreement"
          accessibilityState={{ disabled: !canSign }}
          style={[styles.primaryBtn, !canSign && styles.disabled]}
          disabled={!canSign}
          onPress={onSign}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>Sign agreement</Text>
          )}
        </Pressable>

        <Text style={styles.note}>
          Your name, email, the time and your device are recorded with your signature and added to the signed agreement.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40, gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedForeground, fontWeight: '700' },
    title: { fontSize: 28, fontWeight: '800', color: colors.foreground, letterSpacing: -0.7, marginTop: 2 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    stepLabel: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    muted: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    padHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    clearText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    pad: {
      height: PAD_HEIGHT,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: PAD_BACKGROUND,
      overflow: 'hidden',
    },
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
    consentText: { flex: 1, fontSize: 13, color: colors.foreground, lineHeight: 19 },
    primaryBtn: {
      minHeight: 50,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
    secondaryBtn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    disabled: { opacity: 0.5 },
    errorInline: { fontSize: 13, color: colors.danger },
    errorBox: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.dangerMuted,
    },
    errorBoxText: { flex: 1, fontSize: 14, color: colors.danger, lineHeight: 20 },
    note: { fontSize: 12, color: colors.mutedForeground, marginTop: 6, lineHeight: 18 },
  });
