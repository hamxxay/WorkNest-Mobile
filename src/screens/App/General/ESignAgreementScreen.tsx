import { useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Checkbox,
  Screen,
  SectionHeader,
  SegmentedControl,
  SuccessOverlay,
  TextField,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { eSignMyAgreement, openMyAgreementPdf } from "../../../services/agreementService";
import {
  captureSignatureImage,
  signerNameError,
  SIGNATURE_INK,
  TYPED_SIGNATURE_TEXT_STYLE,
} from "../../../services/signatureService";
import { errorMessage } from "../../../services/apiClient";
import { haptics } from "../../../utils/haptics";
import type { AppStackParamList } from "../../../navigation/types";
import { fittingLabel, useContentWidth } from "./shared/layout";

type Props = NativeStackScreenProps<AppStackParamList, "ESignAgreement">;
type SignMode = "draw" | "type";
type Point = { x: number; y: number };

const PAD_HEIGHT = 200;
/** The sign button while signing, then a shorter label for a narrow phone or large text. */
const SIGNING_LABELS = ["Signing your agreement", "Signing"] as const;
/** "Read the agreement" button, before and after it was opened (full wording first, shorter ones after). */
const READ_LABELS = ["Read agreement (PDF)", "Read agreement", "Read PDF"] as const;
const READ_AGAIN_LABELS = ["Opened. Read it again", "Read it again", "Read again"] as const;
const CONSENT_TEXT =
  "I have read the agreement and agree to sign it electronically. My electronic signature has the same effect as a handwritten one.";

function toPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const fx = first.x.toFixed(1);
  const fy = first.y.toFixed(1);
  // A tap is a dot: a tiny segment drawn with round caps.
  if (rest.length === 0) return `M${fx} ${fy} L${(first.x + 0.1).toFixed(1)} ${fy}`;
  return `M${fx} ${fy}` + rest.map((p) => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

/**
 * Sign a lease agreement electronically, like the website's e-sign panel: read the PDF, enter the signer's
 * name, draw the signature or type it (handwriting font), agree, then POST /Agreement/my/{id}/esign.
 * The signature box is always white with dark ink (it becomes part of the signed document).
 */
export default function ESignAgreementScreen({ navigation, route }: Props) {
  const { agreementId, quotationNumber, customerName } = route.params;
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const toast = useToast();
  const { fontScale } = useWindowDimensions();
  const contentWidth = useContentWidth();

  const initialName = (typeof user?.name === "string" ? user.name : customerName ?? "").trim();
  const [signerName, setSignerName] = useState(initialName);
  const [mode, setMode] = useState<SignMode>("draw");
  const [typed, setTyped] = useState(initialName);
  const [consent, setConsent] = useState(false);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentStroke, setCurrentStroke] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Set once signed: shows the success overlay, then goes back.
  const [signed, setSigned] = useState<{ title: string; message: string } | null>(null);

  const padRef = useRef<View>(null);
  const typedRef = useRef<View>(null);
  const pointsRef = useRef<Point[]>([]);
  const padSize = useRef({ width: 0, height: PAD_HEIGHT });
  const submittingRef = useRef(false);

  const nameError = signerName ? signerNameError(signerName) : null;
  const hasSignature = mode === "draw" ? strokes.length > 0 : typed.trim().length >= 2;
  const canSign = !signerNameError(signerName) && hasSignature && consent && !submitting && !signed;

  const onViewAgreement = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openMyAgreementPdf(agreementId);
      setViewed(true);
    } catch (err) {
      toast.error(errorMessage(err, "The agreement could not be opened. Please try again."));
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
    setError("");
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
    if (path) setStrokes((prev) => [...prev, path]);
    setCurrentStroke("");
    setDrawing(false);
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => startStroke(e.x, e.y))
    .onUpdate((e) => extendStroke(e.x, e.y))
    .onFinalize(() => endStroke());
  const onPadLayout = (e: LayoutChangeEvent) => {
    padSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  };
  const clearPad = () => {
    pointsRef.current = [];
    setStrokes([]);
    setCurrentStroke("");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSign = async () => {
    if (!canSign || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const signatureImage = await captureSignatureImage(mode === "draw" ? padRef : typedRef);
      const result = await eSignMyAgreement(agreementId, {
        signerName: signerName.trim(),
        signatureImage,
        consent: true,
      });
      setSigned({ title: result.completed ? "Agreement signed" : "Signature received", message: result.message });
    } catch (err) {
      haptics.error();
      setError(errorMessage(err, "We could not complete your signature. Please try again."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Sign agreement" subtitle={quotationNumber ? `Quotation ${quotationNumber}` : `Agreement #${agreementId}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawing}
      >
        <SectionHeader title="1. Read the agreement" />
        <Card>
          <AppText variant="bodySmall" color="textSecondary">
            Open the agreement and read it before you sign. It opens in your phone's PDF viewer.
          </AppText>
          <Button
            // Inside the card (16dp padding each side): a shorter label when the full one would be clipped.
            title={fittingLabel(viewed ? READ_AGAIN_LABELS : READ_LABELS, contentWidth - 32, fontScale, true, 0)}
            accessibilityLabel={viewed ? READ_AGAIN_LABELS[0] : READ_LABELS[0]}
            variant="secondary"
            leftIcon={viewed ? "checkmark-circle-outline" : "document-text-outline"}
            loading={opening}
            style={styles.top}
            onPress={onViewAgreement}
          />
        </Card>

        <SectionHeader title="2. Your signature" />
        <Card>
          <View style={styles.fields}>
            <TextField
              label="Your full name"
              required
              value={signerName}
              onChangeText={setSignerName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
              disabled={submitting}
              error={nameError}
              leftIcon="person-outline"
            />
            <SegmentedControl
              value={mode}
              onChange={setMode}
              accessibilityLabel="Signature type"
              options={[
                { label: "Draw", value: "draw", icon: "brush-outline" },
                { label: "Type", value: "type", icon: "text-outline" },
              ]}
            />
            {mode === "draw" ? (
              <>
                {/* The touch area and the drawing surface are the same unpadded box filling the pad, so the ink
                    lands exactly under the finger and reaches every edge. */}
                <View
                  ref={padRef}
                  collapsable={false}
                  style={[styles.pad, styles.drawPad]}
                  accessible
                  accessibilityLabel="Signature pad. Draw your signature with your finger."
                >
                  <GestureDetector gesture={pan}>
                    <View collapsable={false} style={StyleSheet.absoluteFill} onLayout={onPadLayout}>
                      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                        {strokes.map((d, i) => (
                          <Path key={`stroke-${i}`} d={d} stroke={SIGNATURE_INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        ))}
                        {currentStroke ? (
                          <Path d={currentStroke} stroke={SIGNATURE_INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        ) : null}
                      </Svg>
                    </View>
                  </GestureDetector>
                </View>
                <View style={styles.padFooter}>
                  <AppText variant="caption" color="textMuted" style={styles.flex}>
                    Sign inside the white box with your finger.
                  </AppText>
                  <Button title="Clear" variant="ghost" size="sm" leftIcon="refresh" disabled={!strokes.length || submitting} onPress={clearPad} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  label="Type your signature"
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="words"
                  maxLength={100}
                  disabled={submitting}
                />
                <View ref={typedRef} collapsable={false} style={styles.pad} accessible accessibilityLabel={`Typed signature: ${typed}`}>
                  <Text style={[TYPED_SIGNATURE_TEXT_STYLE, styles.typedText]} numberOfLines={1} adjustsFontSizeToFit>
                    {typed.trim() || " "}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Card>

        <SectionHeader title="3. Agree and sign" />
        <Checkbox checked={consent} onChange={setConsent} disabled={submitting} label={CONSENT_TEXT} />

        {error ? <Banner tone="danger" title="Not signed" message={error} /> : null}

        <Button
          title={submitting ? fittingLabel(SIGNING_LABELS, contentWidth, fontScale, true) : "Sign agreement"}
          accessibilityLabel={submitting ? SIGNING_LABELS[0] : "Sign agreement"}
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSign}
          onPress={onSign}
          haptic
        />
        <AppText variant="caption" color="textMuted" align="center">
          Your name, email, the time and your device are recorded with your signature and added to the signed agreement.
        </AppText>
      </ScrollView>
      <SuccessOverlay
        visible={!!signed}
        title={signed?.title ?? ""}
        message={signed?.message}
        onHidden={() => navigation.goBack()}
      />
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    fields: { gap: t.spacing.md },
    top: { marginTop: t.spacing.md },
    flex: { flex: 1 },
    // The signature is part of the signed PDF: paper (always white) with dark ink in light and dark mode.
    // The padding is for the typed signature only (see drawPad).
    pad: {
      height: PAD_HEIGHT,
      borderRadius: t.radii.control,
      borderWidth: 1,
      borderColor: c.paperBorder,
      backgroundColor: c.paper,
      overflow: "hidden",
      justifyContent: "center",
      paddingHorizontal: t.spacing.lg,
    },
    // Drawing: no padding, so touch coordinates (relative to the pad's inner box) and the Svg share one origin.
    drawPad: { paddingHorizontal: 0 },
    typedText: { width: "100%" },
    padFooter: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  });
