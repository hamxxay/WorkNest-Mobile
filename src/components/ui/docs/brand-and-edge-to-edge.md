# Brand logo, app icon and edge-to-edge

Part of the UI kit guide (`../README.md`). Covers `<BrandLogo>`, the generated app icon / splash assets, and how
screens, headers and sheets deal with Android edge-to-edge (transparent system bars).

---

## 1. `<BrandLogo>`

The WorkNest logo is the silver ribbon "W" (the CMS logo, `public/Logo.png`) on brand navy `#0f172a`. Use
`BrandLogo` instead of `<Image source={require(".../Logo1.png")}>` anywhere the logo appears.

```tsx
import { BrandLogo } from "../../components/ui";

<BrandLogo size={108} />                                        // splash, navy screens: the silver W, 108dp wide
<BrandLogo variant="tile" size={44} wordmark />                 // light pages: navy tile (like the app icon) + "WorkNest"
<BrandLogo variant="tile" size={36} />                          // AppHeader on light bars (automatic)
<BrandLogo size={34} color={colors.onHeader} />                 // one-colour W (e.g. on the teal header)
<BrandLogo size={120} wordmark layout="column" wordmarkColor={colors.onHeader} />
```

| Prop | Default | |
| --- | --- | --- |
| `variant` | `"mark"` | `mark`: the W alone, for navy / dark backgrounds. `tile`: the W on a navy rounded square, any background |
| `size` | 40 / 44 | mark: width of the W; tile: side of the square (the W is 62% of it) |
| `color` | silver artwork | tints the W one colour |
| `wordmark` | false | adds "WorkNest" (typography token, so it follows the brand font) |
| `layout` | `"row"` | `"column"` puts the wordmark under the logo |
| `wordmarkColor` | `colors.text` | e.g. `colors.onHeader` on navy |
| `wordmarkVariant` | `title` / `heading` (row), `display` (column) | any typography variant |
| `accessible` | true | one image named "WorkNest"; pass false when a visible title already says WorkNest |

Also exported: `BRAND_NAVY` (`palette.slate[900]`, the same in light and dark mode) and `BRAND_W_ASPECT` (W
width / height, 1.577). The silver W is light grey: on white or light surfaces use `variant="tile"` or a `color`.

Where it is used: the JS splash (`src/screens/Auth/splash`), Login / Signup (`AuthLayout`: tile + wordmark) and
`AppHeader` (tile on light bars, silver W on the navy dashboard bar, white W on the teal bar).

---

## 2. App icon and splash assets

All bitmaps come from one script. Change the logo or the proportions there and run it again (Pillow only):

```sh
python3 scripts/make-app-icons.py                       # source: public/Logo.png
python3 scripts/make-app-icons.py --preview /tmp/icons.png   # also writes a contact sheet to check by eye
```

| Output (`android/app/src/main/res/`) | What |
| --- | --- |
| `mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml` | adaptive icon: navy colour background, W foreground, monochrome layer (hand-written XML, not generated) |
| `values/ic_launcher_background.xml` | `#0F172A` (hand-written) |
| `mipmap-<density>/ic_launcher_foreground.png` | 108dp canvas, W inside the 66dp safe zone (about 52dp wide, optically centred) |
| `mipmap-<density>/ic_launcher_monochrome.png` | white W silhouette, Android 13+ themed icons |
| `mipmap-<density>/ic_launcher.png`, `ic_launcher_round.png` | legacy icons (Android 7.x): W on a navy rounded square / circle, 48dp |
| `drawable-<density>/splash_icon.png` | Android 12+ splash icon: 288dp canvas, W (about 107dp wide) inside the 192dp circle |
| `ic_launcher-web.png` | 512x512 Play Store icon: full-bleed navy square (Play rounds the corners itself) |
| `src/assets/brand/worknest-w.png` (+ `@2x`, `@3x`) | the W tightly cropped, used by `BrandLogo` |

Splash flow on Android 12+: the system splash (`values-v31/styles.xml`: `windowSplashScreenBackground` =
`splash_background` navy, `windowSplashScreenAnimatedIcon` = `splash_icon`) hands over to the JS splash, which
shows the W at the same width (`SPLASH_LOGO_WIDTH` = 108) on `headerBg` navy in both modes. Before Android 12 there
is no system splash; the window background (`window_background`) shows until JS renders.

The launcher label is `@string/app_name` = "WorkNest".

---

## 3. Edge-to-edge (Android)

`android/gradle.properties` has `edgeToEdgeEnabled=true`, so on every Android version the app draws behind
transparent status and navigation bars (Android 15+ with targetSdk 35+ enforces this anyway). Nothing paints the
bars for you: whatever the app draws under them shows through.

### What the kit does

| Area | Who handles it |
| --- | --- |
| Status bar strip | `<Screen>` paints a view of the top-inset height in the header colour (AppHeader registers it) or the page background. An `AppHeader` outside a `<Screen>` extends its own background under the bar. |
| Status-bar icons | `<Screen>` / `AppHeader` set `light-content` / `dark-content` from that colour while the screen is focused (`FocusAwareStatusBar`, `barStyleFor`). App.tsx sets the base style. |
| Bottom (gesture bar / 3-button bar) and side cutouts | `<Screen>` pads `edges` (default all four). Tab screens leave out `"bottom"` because the tab bar covers that inset. |
| Navigation-bar icon colour | `MainActivity` sets dark icons in light mode and light icons in dark mode, following the in-app Appearance choice (on 3-button navigation Android adds its own contrast scrim). |
| Keyboard | An edge-to-edge window is no longer shrunk by `adjustResize`, so `MainActivity` pads the React root by the keyboard height. Screens behave as before: content ends at the top of the keyboard, `insets.bottom` becomes 0 while it is open, existing `KeyboardAvoidingView`s keep working. |
| `BottomSheet` | Modal with `statusBarTranslucent` + `navigationBarTranslucent`; the sheet stays below the status bar, pads the bottom inset (footer or sheet) and uses `KeyboardAvoidingView behavior="padding"` on both platforms. |
| Toasts, `ConfirmDialog` | positioned with the safe-area insets / centred. |

### Rules for screens and components

- Wrap every screen in `<Screen>`; never set `edges` without `"top"` unless the screen deliberately draws under the
  status bar (and then pad its own content with `useSafeAreaInsets().top`).
- No `StatusBar` `backgroundColor` / `translucent` and no `StatusBar.currentHeight`: Android ignores the first two in
  edge-to-edge mode (and logs a warning), and the height is in `useSafeAreaInsets().top`. Use `statusBarColor` /
  `statusBarStyle` on `<Screen>` if a screen needs to force the strip colour.
- Use `react-native-safe-area-context` (`useSafeAreaInsets`, its `SafeAreaView`), not the deprecated `SafeAreaView`
  from `react-native`.
- Anything pinned to the bottom of the screen outside `<Screen>`'s padding (floating buttons, sticky footers, a custom
  tab bar) adds `insets.bottom` itself, so it never sits under the gesture bar.
- Your own `<Modal>`: the modal window is edge-to-edge too. Pass `statusBarTranslucent navigationBarTranslucent`,
  pad the top content by `insets.top` and the bottom content by `insets.bottom`, and use
  `KeyboardAvoidingView behavior="padding"` (Android does not resize a modal for the keyboard). Prefer `BottomSheet`.
- Status bar over a photo or a coloured hero without a header: pass `statusBarColor` (the strip colour) or
  `statusBarStyle` to `<Screen>`; the strip is opaque, so content never scrolls under the clock.

### Check on a device after native changes

- Light and dark mode, and the in-app Appearance switch: status-bar icons, navigation-bar icons.
- Gesture navigation and 3-button navigation: nothing tappable under the bar (tab bar, sheet footers, chat input).
- Keyboard: a form at the bottom of a screen (Login, booking forms) and a text field inside a `BottomSheet`
  (SelectField search) and the chat sheet: the focused field stays visible.
- Landscape / cutout phones: side insets.
