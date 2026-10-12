import { amber, emerald, indigo, night, red, sky, slate, teal } from "./palette";

/**
 * Semantic colour palette. Both modes have exactly the same keys.
 *
 * New code should use the semantic keys (background, surface, text, textMuted, primary, ...).
 * The "legacy" keys at the bottom are kept so the ~50 existing screens keep compiling and now follow
 * light/dark mode automatically; they are aliases of the semantic keys.
 */
export type AppColors = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  /** Page background behind cards. */
  background: string;
  /** Cards, list rows, inputs, headers on light pages. */
  surface: string;
  /** Subtle fills: chips, segmented track, read-only inputs, table stripes. */
  surfaceAlt: string;
  /** Bottom sheets, dialogs, toasts (sits above the page). */
  surfaceRaised: string;

  // ── Text ──────────────────────────────────────────────────────────────────
  text: string;
  /** Secondary body text (higher contrast than textMuted). */
  textSecondary: string;
  /** Captions, helper text, meta. >= 4.5:1 on surface. */
  textMuted: string;
  /** Disabled text / icons (not required to meet contrast). */
  textDisabled: string;
  /** TextInput placeholderTextColor. */
  placeholder: string;

  // ── Lines ─────────────────────────────────────────────────────────────────
  /** Decorative card borders and dividers. */
  border: string;
  /** Stronger dividers, outline-button borders. */
  borderStrong: string;
  /** Resting border of inputs / selects. >= 3:1 against surface (WCAG 1.4.11). */
  inputBorder: string;
  /** Focus ring / focused input border. */
  focus: string;

  // ── Brand / actions ───────────────────────────────────────────────────────
  /**
   * Teal for links, icons, active tab tint, selected borders and (legacy) button fills.
   * Light: #0f766e (5.5:1 on white). Dark: #0d9488 (4.6:1 on dark surface).
   */
  primary: string;
  /** Fill for anything that carries white text (primary Button, selected Chip). White text >= 5:1 in both modes. */
  primaryStrong: string;
  /** Pressed state of primaryStrong. */
  primaryPressed: string;
  /** Text / icons placed ON a primary fill. */
  onPrimary: string;
  /** Alias of onPrimary (text colour on a primary fill). For teal text use `primary` or `link`. */
  primaryText: string;
  /** Soft teal tint (selected rows, icon wells, info banners). */
  primarySoft: string;
  /** Teal text/icons placed ON primarySoft. */
  onPrimarySoft: string;
  /** The brand teal #0d9488 itself (logo accents, decorative fills, charts). */
  brand: string;
  /** Inline text links. */
  link: string;

  // ── Feedback ──────────────────────────────────────────────────────────────
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /** Fill for destructive buttons (white text). */
  dangerStrong: string;
  dangerPressed: string;
  info: string;
  infoSoft: string;

  // ── Chrome ────────────────────────────────────────────────────────────────
  /** Navy "dashboard" header / dark hero background. */
  headerBg: string;
  /** Text and icons on headerBg. */
  onHeader: string;
  /** Secondary text on headerBg. */
  onHeaderMuted: string;
  /** Modal / sheet backdrop. */
  overlay: string;
  /** Skeleton placeholder blocks. */
  skeleton: string;
  /** android_ripple colour on surfaces. */
  ripple: string;
  /** android_ripple colour on primary / dark fills. */
  rippleOnPrimary: string;
  /** Tab bar and navigation chrome. */
  tabBar: string;
  tabInactive: string;

  // ── Paper (documents) ─────────────────────────────────────────────────────
  /** Always-light "document" surface in BOTH modes: signature pads and previews, PDF/receipt thumbnails. */
  paper: string;
  /** Ink on paper (signature strokes, document text). Same in both modes. */
  onPaper: string;
  /** Edge of a paper well, visible on light and dark pages. */
  paperBorder: string;

  // ── Legacy keys (kept for existing screens; prefer the semantic keys above) ──
  /** = surface */
  card: string;
  /** = text */
  foreground: string;
  /** = textMuted */
  mutedForeground: string;
  /** Darker teal (light) / mid teal (dark). Used as a button fill by a few screens. */
  secondary: string;
  /** = primarySoft-ish, very light teal wash. */
  primaryMuted: string;
  /** = surfaceAlt */
  muted: string;
  /** Deep teal accent; carries white text. */
  accent: string;
  accentMuted: string;
  /** = successSoft */
  successMuted: string;
  /** = dangerSoft */
  dangerMuted: string;
  /** shadowColor for iOS / Android 28+ coloured elevation. */
  shadow: string;
  /** Literally white in BOTH modes. Use `onPrimary` for text on teal, `surface` for card backgrounds. */
  white: string;
};

export const lightColors: AppColors = {
  background: slate[50],
  surface: "#ffffff",
  surfaceAlt: slate[100],
  surfaceRaised: "#ffffff",

  text: slate[900],
  textSecondary: slate[600],
  textMuted: slate[500],
  textDisabled: slate[400],
  placeholder: slate[500],

  border: slate[200],
  borderStrong: slate[300],
  inputBorder: "#7c8ba1",
  focus: teal[700],

  primary: teal[700],
  primaryStrong: teal[700],
  primaryPressed: teal[800],
  onPrimary: "#ffffff",
  primaryText: "#ffffff",
  primarySoft: teal[100],
  onPrimarySoft: teal[700],
  brand: teal[600],
  link: teal[700],

  success: emerald[700],
  successSoft: emerald[100],
  warning: amber[700],
  warningSoft: amber[100],
  danger: red[600],
  dangerSoft: red[100],
  dangerStrong: red[600],
  dangerPressed: red[700],
  info: sky[700],
  infoSoft: sky[100],

  headerBg: slate[900],
  onHeader: "#ffffff",
  onHeaderMuted: "rgba(255, 255, 255, 0.72)",
  overlay: "rgba(15, 23, 42, 0.55)",
  skeleton: slate[200],
  ripple: "rgba(15, 23, 42, 0.08)",
  rippleOnPrimary: "rgba(255, 255, 255, 0.24)",
  tabBar: "#ffffff",
  tabInactive: slate[500],

  paper: "#ffffff",
  onPaper: "#0a1628",
  paperBorder: slate[300],

  card: "#ffffff",
  foreground: slate[900],
  mutedForeground: slate[500],
  secondary: teal[700],
  primaryMuted: teal[50],
  muted: slate[100],
  accent: teal[800],
  accentMuted: "rgba(13, 148, 136, 0.08)",
  successMuted: emerald[100],
  dangerMuted: red[100],
  shadow: slate[900],
  white: "#ffffff",
};

export const darkColors: AppColors = {
  background: night.background,
  surface: night.surface,
  surfaceAlt: night.surfaceAlt,
  surfaceRaised: night.raised,

  text: slate[100],
  textSecondary: slate[300],
  textMuted: slate[400],
  textDisabled: slate[600],
  placeholder: "#7b8aa3",

  border: night.border,
  borderStrong: slate[700],
  inputBorder: slate[500],
  focus: teal[400],

  primary: teal[600],
  primaryStrong: teal[700],
  primaryPressed: teal[800],
  onPrimary: "#ffffff",
  primaryText: "#ffffff",
  primarySoft: "rgba(45, 212, 191, 0.14)",
  onPrimarySoft: teal[300],
  brand: teal[600],
  link: teal[400],

  success: emerald[400],
  successSoft: "rgba(52, 211, 153, 0.14)",
  warning: amber[400],
  warningSoft: "rgba(251, 191, 36, 0.14)",
  danger: red[400],
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  dangerStrong: red[600],
  dangerPressed: red[700],
  info: sky[400],
  infoSoft: "rgba(56, 189, 248, 0.14)",

  headerBg: night.header,
  onHeader: "#ffffff",
  onHeaderMuted: "rgba(255, 255, 255, 0.7)",
  overlay: "rgba(0, 0, 0, 0.62)",
  skeleton: night.surfaceAlt,
  ripple: "rgba(255, 255, 255, 0.10)",
  rippleOnPrimary: "rgba(255, 255, 255, 0.24)",
  tabBar: night.surface,
  tabInactive: slate[400],

  paper: "#ffffff",
  onPaper: "#0a1628",
  paperBorder: slate[600],

  card: night.surface,
  foreground: slate[100],
  mutedForeground: slate[400],
  secondary: teal[700],
  primaryMuted: "rgba(45, 212, 191, 0.10)",
  muted: night.surfaceAlt,
  accent: teal[600],
  accentMuted: "rgba(45, 212, 191, 0.14)",
  successMuted: "rgba(52, 211, 153, 0.14)",
  dangerMuted: "rgba(248, 113, 113, 0.14)",
  shadow: "#000000",
  white: "#ffffff",
};

// ─── Status tones (StatusPill, StatCard, Badge) ───────────────────────────────

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "indigo";

export type ToneColors = {
  /** Text / icon colour on `bg`. */
  fg: string;
  /** Soft background. */
  bg: string;
  /** Hairline border around the pill. */
  border: string;
  /** Solid colour: dots, bars, progress, KPI accents. */
  solid: string;
};

/** Light tones mirror the CMS badges (kyc.css / manage.css): e.g. success #047857 on #d1fae5. */
export const lightTones: Record<Tone, ToneColors> = {
  neutral: { fg: slate[600], bg: slate[100], border: slate[300], solid: slate[500] },
  primary: { fg: teal[700], bg: teal[100], border: teal[200], solid: teal[600] },
  success: { fg: emerald[700], bg: emerald[100], border: emerald[200], solid: emerald[600] },
  warning: { fg: amber[700], bg: amber[100], border: amber[200], solid: amber[600] },
  danger: { fg: red[700], bg: red[100], border: red[200], solid: red[600] },
  info: { fg: sky[700], bg: sky[100], border: sky[200], solid: sky[600] },
  indigo: { fg: indigo[700], bg: indigo[100], border: indigo[200], solid: indigo[500] },
};

export const darkTones: Record<Tone, ToneColors> = {
  neutral: { fg: slate[300], bg: "rgba(148, 163, 184, 0.16)", border: "rgba(148, 163, 184, 0.35)", solid: slate[400] },
  primary: { fg: teal[300], bg: "rgba(20, 184, 166, 0.16)", border: "rgba(45, 212, 191, 0.35)", solid: teal[500] },
  success: { fg: emerald[300], bg: "rgba(16, 185, 129, 0.16)", border: "rgba(52, 211, 153, 0.35)", solid: emerald[500] },
  warning: { fg: amber[300], bg: "rgba(245, 158, 11, 0.16)", border: "rgba(251, 191, 36, 0.35)", solid: amber[500] },
  danger: { fg: red[300], bg: "rgba(239, 68, 68, 0.16)", border: "rgba(248, 113, 113, 0.35)", solid: red[500] },
  info: { fg: sky[300], bg: "rgba(14, 165, 233, 0.16)", border: "rgba(56, 189, 248, 0.35)", solid: sky[500] },
  indigo: { fg: indigo[300], bg: "rgba(99, 102, 241, 0.18)", border: "rgba(129, 140, 248, 0.35)", solid: indigo[400] },
};
