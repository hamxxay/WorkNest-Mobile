# Brand font: Inter

The app uses **Inter**, the font of the web CMS, in four weights: 400 Regular, 500 Medium, 600 SemiBold,
700 Bold. Every `typography.*` variant, `<AppText>`, the UI kit and the React Navigation theme fonts use it.

Android only for now. iOS keeps the system font until the files are linked there (see "iOS" below).

**Native rebuild required.** The font files are packaged into the APK at build time. A Metro reload or fast
refresh is not enough: rebuild and reinstall the app (`npx react-native run-android`). Until then text falls
back to Roboto.

## Files

`android/app/src/main/assets/fonts/` (next to the icon fonts):

| File | Weight | `fontFamily` | Picked when |
| --- | --- | --- | --- |
| `Inter.ttf` | 400 | `Inter` | fontWeight below 700 |
| `Inter_bold.ttf` | 700 | `Inter` | fontWeight 700 (React Native adds `_bold`) |
| `Inter-Medium.ttf` | 500 | `Inter-Medium` | always (own family) |
| `Inter-SemiBold.ttf` | 600 | `Inter-SemiBold` | always (own family) |
| `Inter-OFL.txt` | | | licence text |

- Source: Inter 4.001 static TTFs (Google Fonts build), taken from `@expo-google-fonts/inter@0.4.2`
  (`Inter_400Regular.ttf`, `Inter_500Medium.ttf`, `Inter_600SemiBold.ttf`, `Inter_700Bold.ttf`), renamed.
  Only the files were copied; the npm package is not a dependency.
- Licence: SIL Open Font License 1.1, copyright The Inter Project Authors. `Inter-OFL.txt` must stay next to
  the fonts (it ships in the APK with them, as the OFL asks copies to carry the licence). Do not sell the font
  files on their own.
- Size: about 1.4 MB added to the APK (four files of about 340 KB).
- The files support tabular figures (`tnum`), used for KPI and money values.

## How the weights work on Android

React Native loads an asset font by family name: `fontFamily: "X"` opens `assets/fonts/X.ttf`, or
`assets/fonts/X_bold.ttf` when `fontWeight` is 700 or more. It never picks a 500 or 600 file from a family
name, and a family with no `_bold` file plus `fontWeight: "700"` silently falls back to Roboto Bold. So:

- 400 and 700 share the family `Inter` (`Inter.ttf` + `Inter_bold.ttf`), so a plain bold override works.
- 500 and 600 are separate families (`Inter-Medium`, `Inter-SemiBold`).
- `fontFor(weight)` returns the matching pair, e.g. `fontFor("600")` is
  `{ fontFamily: "Inter-SemiBold", fontWeight: "600" }`. Every `typography.*` variant is built with it.

These names are also the fonts' iOS names (family `Inter`, PostScript `Inter-Medium` / `Inter-SemiBold`), so the
same styles work on iOS once linked.

Why not a `res/font/inter.xml` font family? It would let a single `fontFamily: "inter"` take any weight, but
React Native only reads `res/font` after `ReactFontManager.getInstance().addCustomFont(this, "Inter", R.font.inter)`
in `MainApplication.onCreate`. The asset files need no native code. To switch later: move the four TTFs to
`res/font/` (lower-case names, e.g. `inter_semibold.ttf`), add `inter.xml` mapping 400/500/600/700, register it
in `MainApplication`, and make `fontFor` return `{ fontFamily: "Inter", fontWeight }` for every weight.

## Using it

```tsx
import { fontFor, tabularNums } from "../../theme";

// 1. Variants (preferred): already Inter at the right weight.
title: { ...t.typography.heading, color: c.text },
<AppText variant="label">Status</AppText>

// 2. A different weight on a variant.
<AppText variant="body" weight="600">Due today</AppText>          // AppText re-picks the file
meta: { ...t.typography.bodySmall, ...fontFor("600") },            // in a StyleSheet

// 3. A one-off size (rare; prefer a variant).
badge: { fontSize: 12, lineHeight: 14, ...fontFor("700") },

// 4. Numbers that line up or change in place.
<AppText variant="amount">{formatMoney(total)}</AppText>          // bodyStrong + tabular figures
<AppText variant="kpi">{count}</AppText>                          // already tabular
value: { ...t.typography.subheading, ...tabularNums },
```

Rules:

- Never write a bare `fontWeight` in a style. On Android it either keeps the regular file (`body` +
  `fontWeight: "600"` renders Inter Regular) or falls back to Roboto (`Inter-SemiBold` + `"700"`). Use a
  variant, `fontFor()` or `<AppText weight>`.
- Never type the family names (`"Inter-SemiBold"`) in screens; `fontFor()` owns the mapping.
- `<AppText>` is safe with overrides: it flattens its style and runs `withBrandFont()`, so a `fontWeight` in
  `style` or the `weight` prop switches to the right file. Raw `<Text>` / `<TextInput>` do not do this; spread a
  variant or `fontFor()` into them. `withBrandFont(style)` is exported for the rare custom text component.
- Weights 800 / 900 are retired; `fontFor("800")` gives 700. Below 400 gives 400 (no light files shipped).
- Chart labels drawn with react-native-svg (`<Text>` / `<TSpan>` from `react-native-svg`): use `svgFontFor(weight)`,
  not `fontFor`. react-native-svg opens `assets/fonts/<fontFamily>.ttf` itself and ignores the `_bold` rule, so
  `fontFor("700")` would draw the regular file there; `svgFontFor("700")` names `Inter_bold`.
  `<SvgText {...svgFontFor("600")} fontSize={12} fill={c.textMuted}>Jan</SvgText>`

New variant: `amount` (15/22, 600, tabular figures) for money in rows and lists. The staff booking, invoice and
quotation lists use it; emphasised `InfoRow` values (totals) and `kpi` (StatCard) are tabular as well.

## Intentional exceptions (not Inter)

- `GoogleSignInButton`: Roboto Medium, as Google's sign-in branding requires.
- Typed e-signature (`TYPED_SIGNATURE_TEXT_STYLE`): the handwriting font (`cursive`).
- Icon fonts (Ionicons and the other vector-icon families).
- Native system UI: date / time pickers, `Alert` dialogs, the keyboard.

Known gap: `AppHeader`'s brand title (`brandTitle`, 19/24 with a bare `fontWeight: "700"`) still renders Roboto Bold.
The fix is one line in `AppHeader.tsx`: `brandTitle: { fontSize: 19, lineHeight: 24, ...fontFor("700"), letterSpacing: -0.2 }`.

## Metrics and layout

- Inter is slightly wider than Roboto at the same size; long single-line labels with `numberOfLines={1}` may
  truncate sooner. Variants keep their sizes and line heights.
- Inter's vertical metrics differ from Roboto's, so Android's extra font padding (`includeFontPadding`) changes
  too. Variants set an explicit `lineHeight`, and kit text that must sit centred in a box (Button, Badge,
  StatusPill) sets `includeFontPadding: false`. Do the same for a custom pill or badge.

## iOS (not enabled yet)

`hasBrandFont()` is false on iOS, so `fontFor()` returns only `fontWeight` and the system font is used. To enable:
add the four TTFs to the Xcode target (Copy Bundle Resources), list them under `UIAppFonts` in `Info.plist`,
then add `"ios"` to `BRAND_FONT_PLATFORMS` in `src/theme/typography.ts`. No other code changes are needed.

## Tests

`src/theme/typography.test.ts` checks that every variant maps its weight to the right family, that the file
React Native would open (`<family>[_bold].ttf`) exists in the Android fonts folder, that the licence is there,
and that KPI / money styles are tabular.
