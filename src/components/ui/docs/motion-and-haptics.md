# Motion and haptics

Small, quick motion and subtle haptics that confirm what the user did. Everything here honours the OS
"Remove animations" / "Reduce motion" setting (no animation while it is on) and the user's haptics switch.

```ts
import { Button, SuccessCheck, SuccessOverlay, useToast } from "../../components/ui";
import { ScalePressable, useReduceMotion } from "../../components/motion";
import { haptics } from "../../utils/haptics";
```

---

## 1. Reduce motion: `useReduceMotion()`

`useReduceMotion()` returns `true` while the phone asks for less motion (read once with
`AccessibilityInfo.isReduceMotionEnabled()`, then kept current through `reduceMotionChanged`).
`isReduceMotionEnabled()` gives the latest value outside React. Every animated kit component checks it and shows
its final state at once. Do the same in custom animations:

```tsx
const reduceMotion = useReduceMotion();
useEffect(() => {
  if (reduceMotion) { value.setValue(1); return; }
  Animated.timing(value, { toValue: 1, duration: 250, useNativeDriver: true }).start();
}, [reduceMotion]);
```

---

## 2. Press feedback: `ScalePressable`

Button, IconButton, pressable Card, ListRow, Chip, StatCard / KpiCard and the Home quick actions shrink slightly
while pressed and spring back on release (RN Animated, native driver). Ripple and pressed colours are unchanged.

| Component | Scale |
| --- | --- |
| Button, Chip, StatCard (`PRESS_SCALE`) | 0.97 |
| Card, ListRow (`PRESS_SCALE_LARGE`: big surfaces, same feel with fewer pixels of movement) | 0.98 |
| IconButton (small round targets) | 0.92 |
| Chip with `onRemove` (joined to its remove button) | none |

For a custom pressable, use `ScalePressable` instead of `Pressable`. It takes the same props, including the
`style` / `children` callbacks with `{ pressed }`:

```tsx
<ScalePressable
  accessibilityRole="button"
  accessibilityLabel="Open space"
  onPress={open}
  android_ripple={{ color: colors.ripple }}
  style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
  pressScale={0.97}          // default; 1 turns the scale off
  haptic="light"             // optional, played on press (see section 6)
>
  ...
</ScalePressable>
```

---

## 3. Loading shimmer: `SkeletonGroup` / `SkeletonBlock`

`ListSkeleton`, `KpiSkeleton`, the StatCard `loading` state and any `SkeletonBlock` inside a `SkeletonGroup` show a
soft highlight that sweeps left to right (about 1.1 s, then a short rest). The highlight is aligned to the window,
so it crosses every placeholder at the same moment like one light passing over the screen. Colours come from the
theme: base `colors.skeleton`, a white sheen in light mode and a faint lift in dark mode. With reduce motion on,
the blocks are still. No API change.

---

## 4. List entrance: `AsyncList`

When an `AsyncList` first shows data, its first 10 rows fade in and rise 12dp, staggered by 45 ms (280 ms each,
native driver). Next pages, cells recycled back into view and rows mounted after the first second appear at once,
so long lists stay fast. The animation starts over when the list is empty again (new search, filter or reload).

```tsx
<AsyncList ... animateEntrance={false} />   // opt out (default true)
```

`FadeInView` (same motion, for one-off content) now honours reduce motion and takes `animate={false}`:

```tsx
<FadeInView index={i}>{card}</FadeInView>
```

---

## 5. Success moments: `SuccessCheck` and `SuccessOverlay`

### SuccessCheck

A ring draws itself, then a tick, with a small pop (react-native-svg stroke dashes driven by Reanimated on the UI
thread, about 0.6 s). With reduce motion on it shows the finished mark.

```tsx
<SuccessCheck />                                         // 64dp, success tone, tinted disc
<SuccessCheck size={24} accessibilityLabel={null} />      // inline, next to text that says what happened
<SuccessCheck size={48} haptic onDone={() => ...} />      // success haptic as the tick is drawn
<SuccessCheck key={attempt} />                            // a new key replays it
```

Props: `size` (64), `tone` (`"success"`), `color` (stroke override), `filled` (tinted disc, true), `animate`
(true), `delay` (ms), `haptic` (false), `onDone`, `accessibilityLabel` ("Done"; `null` when the text beside it
already says it), `style`.

### SuccessOverlay

A short, celebratory confirmation: dimmed screen, a card with the check, a title and a message. It plays the
success haptic, is announced to screen readers, hides by itself after 1.6 s (4 s while a screen reader is on) and
can be tapped away. Use it for the big moments only.

```tsx
const [done, setDone] = useState<string | null>(null);
// on success:
setDone(result.message);
// render (anywhere in the screen; it is a Modal):
<SuccessOverlay visible={!!done} title="Quotation sent" message={done} onHidden={() => setDone(null)} />
```

Props: `visible`, `title`, `message`, `duration`, `onHidden` (called once after it hides: navigate, refresh or
clear `visible` there).

### Where they are used

| Moment | Feedback |
| --- | --- |
| Booking confirmed (customer BookingConfirm) | the Challan screen opens with a "Booking created" card and a SuccessCheck (route param `justBooked`) + success haptic |
| Agreement signed (customer e-sign) | SuccessOverlay "Agreement signed" / "Signature received", then back |
| Door unlocked (customer Home quick action) | success toast with the drawn check + success haptic |
| Door unlocked (Unlock door screen) | inline SuccessCheck next to the result + success haptic |
| Capacity request approved (staff Approvals) | SuccessOverlay "Request approved" |
| Quotation sent / emailed (staff quotation detail) | SuccessOverlay "Quotation sent" / "Quotation emailed" |

Success toasts (`toast.success`) also draw the check instead of a static icon.

---

## 6. Haptics: `src/utils/haptics.ts`

```ts
haptics.light();      // a primary action was pressed (only where it matters, not every tap)
haptics.medium();     // a physical action starts (Unlock door)
haptics.selection();  // a segmented control / filter chip changed
haptics.success();    // booking created, agreement signed, door unlocked, request approved, quotation sent
haptics.warning();    // the user has to fix something first
haptics.error();      // something failed
haptics.trigger("success");   // same, by kind: HapticKind
```

- Wraps react-native-haptic-feedback. The package is required lazily and every call is wrapped, so it is a safe
  no-op in tests and in an app binary built before the package was added.
- Android's own vibration / touch feedback setting is respected (`ignoreAndroidSystemSettings: false`).
- The user can switch app haptics off: `<HapticsSetting />` (a SwitchRow, saved on the device under
  `@worknest/haptics-enabled`) sits under Appearance in the customer and staff Profile screens.
  `isHapticsEnabled()`, `setHapticsEnabled(bool)` and `subscribeHaptics(listener)` are exported for other UIs.
- Taps and ticks closer than 60 ms count as one gesture (the first plays). Outcomes (success / warning / error)
  always play.

### Built into the kit

| Where | Haptic |
| --- | --- |
| `<Button haptic />` | light on press (`haptic="medium"` etc. for another kind). Default none. |
| `ScalePressable haptic="..."` | that kind on press |
| SegmentedControl, FilterChips | selection when the value changes |
| ConfirmDialog | light on the confirm button; error when it shows an `error` |
| `toast.error(...)` | error (pass `{ haptic: false }` to silence, `{ haptic: "warning" }` for validation) |
| `toast.success(...)` / `toast.info(...)` | none by default; `{ haptic: true }` plays success (info: light) |
| SuccessOverlay | success |
| `SuccessCheck haptic` | success as the tick is drawn |

Buttons with `haptic` today: Confirm booking, Sign agreement, Request tour, Send message, Create quotation,
Send to customer, Send email (quotation), Create booking (staff), Send agreement, Confirm signed agreement.

### Native setup

`react-native-haptic-feedback` 3.0.0 is autolinked (no code changes). It merges the normal `VIBRATE` permission
into the Android manifest (no runtime prompt). A native rebuild (`npm run android` / Gradle) is required once;
until then the JS calls do nothing.
