# WorkNest UI kit

Shared design tokens, theme (light / dark) and components for the mobile app.
Owner: Phase 3 (UI/UX). Phase 1 and Phase 2 use it; please do not edit `src/theme/**` or `src/components/**`
(except `ChatBot.tsx`). Ask for changes instead.

```ts
import { Button, TextField, Card, StatusPill, AsyncList, AppHeader, useToast } from "../../components/ui";
import { useTheme, useThemeColors, useThemedStyles, spacing, radii, typography } from "../../theme";
import { formatMoney, formatDate, formatRelative } from "../../utils/format";
```

Rules: no emojis in UI text (use Ionicons names), Android first, every pressable has a 44dp touch target and an
accessibility label, use semantic colours (never hex codes in screens).

---

## 1. Theme

`App.tsx` wraps the app in `<ThemeProvider>` (persisted System / Light / Dark) and `<ToastProvider>`.

| Hook | Returns |
| --- | --- |
| `useThemeColors()` | the ACTIVE palette (`AppColors`), re-renders on mode change |
| `useThemedStyles(factory)` | `factory(colors, theme)` memoised per palette |
| `useTheme()` | `{ mode, scheme, isDark, colors, tones, typography, spacing, radii, shadows, iconSizes, touchTarget }` |
| `useThemeMode()` | `{ mode: "system" \| "light" \| "dark", setMode, isDark, scheme }` |
| `useTones()` | `Record<Tone, { fg, bg, border, solid }>` |
| `useNavigationTheme()` | React Navigation `Theme` for `<NavigationContainer theme={...}>` |

```tsx
// Module-level factory: memoised. The second argument is the full theme (typography, radii, shadows...).
const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderColor: c.border, borderRadius: t.radii.card, ...t.shadows.sm },
    title: { ...t.typography.heading, color: c.text },
    meta: { ...t.typography.caption, color: c.textMuted },
  });

function MyScreen() {
  const styles = useThemedStyles(createStyles);
  ...
}
```

Static exports (`colors`, `shadows`) are the LIGHT values and never change. A screen styled with the static
`colors` object stays light in dark mode; migrate it to `useThemeColors()` / `useThemedStyles()`.
`shadows.sm/md/lg` (static) still work; for dark-mode-aware shadows use `useTheme().shadows`.

### Colour tokens (`AppColors`; same keys in light and dark)

| Group | Keys |
| --- | --- |
| Surfaces | `background` (page), `surface` (cards, inputs, headers), `surfaceAlt` (subtle fills, chips, tracks), `surfaceRaised` (sheets, dialogs) |
| Text | `text`, `textSecondary`, `textMuted` (>= 4.5:1), `textDisabled`, `placeholder` |
| Lines | `border` (decorative), `borderStrong`, `inputBorder` (>= 3:1 on surface), `focus` |
| Brand | `primary` (teal text / icons / selected borders), `primaryStrong` (fills that carry white text), `primaryPressed`, `onPrimary` (= `primaryText`, text on a teal fill), `primarySoft` + `onPrimarySoft` (tinted wells), `brand` (#0d9488 decorative), `link` |
| Feedback | `success`, `successSoft`, `warning`, `warningSoft`, `danger`, `dangerSoft`, `dangerStrong` (fill with white text), `dangerPressed`, `info`, `infoSoft` |
| Chrome | `headerBg` (navy), `onHeader`, `onHeaderMuted`, `overlay`, `skeleton`, `ripple`, `rippleOnPrimary`, `tabBar`, `tabInactive` |
| Legacy (still work) | `card` = surface, `foreground` = text, `mutedForeground` = textMuted, `muted` = surfaceAlt, `primaryMuted`, `secondary`, `accent`, `accentMuted`, `successMuted`, `dangerMuted`, `shadow`, `white` (always #fff) |

Light `primary` is now `#0f766e` (accessible on white); the brand `#0d9488` is `brand`. Put white text on
`primaryStrong`, not on `primary` (in dark mode `primary` is a lighter teal for readability on dark surfaces).

### Tones (`Tone`)

`"neutral" | "primary" | "success" | "warning" | "danger" | "info" | "indigo"`, each `{ fg, bg, border, solid }`
via `useTones()` / `useTheme().tones`. Light values match the CMS badges (e.g. success `#047857` on `#d1fae5`).

### Typography (`typography.*`, spread into Text styles)

| Variant | Size / line | Weight |
| --- | --- | --- |
| `display` | 28 / 34 | 700 |
| `title` | 22 / 28 | 700 |
| `heading` | 18 / 24 | 600 |
| `subheading` | 16 / 22 | 600 |
| `body` | 15 / 22 | 400 |
| `bodyStrong` | 15 / 22 | 600 |
| `bodySmall` | 14 / 20 | 400 |
| `label` | 14 / 20 | 600 |
| `button` | 16 / 20 | 600 |
| `caption` | 12 / 16 | 400 |
| `captionStrong` | 12 / 16 | 600 |
| `overline` | 11 / 14, uppercase, tracked | 600 |
| `kpi` | 24 / 30, tabular numbers | 700 |

Weights 800 / 900 are retired; use 600 / 700. Or use `<AppText variant="caption" color="textMuted">`.

### Spacing, radii, misc

- `spacing`: `xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 40, screen 16`
- `radii`: `xs 6, sm 10, md 16, lg 22, xl 28, pill 999, control 10, card 14, sheet 20`
- `touchTarget` 44, `iconSizes { sm 16, md 20, lg 24, xl 32 }`
- `getShadows(isDark)` / `useTheme().shadows`: `none, sm, md, lg` (dark: subtle; rely on surfaces + borders)

---

## 2. Status colours: `statusTone`, `statusLabel`, `<StatusPill>`

One map for bookings, quotations, invoices / payments, agreements, KYC, complaints and inquiries. Input is
normalised ("In Progress", "in_progress", "InProgress" are the same).

```tsx
statusTone("Confirmed")      // "success"
statusTone("AgreementSent")  // "info"
statusTone("SignedUploaded") // "warning"
statusLabel("SignedUploaded")// "Signed (under review)"
statusLabel("not_interested")// "Not interested"

<StatusPill status={booking.bookingStatus} />
<StatusPill status="Paid" size="md" icon="checkmark-circle" />
<StatusPill tone="warning" label="Due in 3 days" />
```

| Tone | Statuses |
| --- | --- |
| success | confirmed, approved, accepted, active, paid, verified, signed, completed, resolved, converted, released |
| primary | booked, reserved, checked in, ongoing, in use |
| info | sent, agreement sent, new, open, submitted, issued, scheduled, contacted, upcoming, partial, partially paid |
| warning | pending, unpaid, due, awaiting, in progress, processing, under review, signed uploaded, on hold, follow-up, future prospect, reopened |
| danger | cancelled, rejected, declined, failed, email failed, overdue, expired, forfeited, not interested, blocked, suspended |
| indigo | quoted, refunded |
| neutral | draft, inactive, closed, archived, unknown, anything else |

Numeric codes (KYC 0/1/2) must be mapped to names first: `statusTone(["Pending","Verified","Rejected"][s])`.
Please delete the per-screen `statusColor` / `STATUS_CONFIG` maps when you restyle a screen.

---

## 3. Layout: `Screen` and `AppHeader`

`Screen` paints the page background, handles safe areas, centres content on tablets and owns the status bar.
Status-bar policy: the bar takes the colour of the header under it (AppHeader registers itself) or the page
background, with matching light / dark icons, applied only while the screen is focused.

```tsx
<Screen>
  <AppHeader title="Booking details" subtitle="BK-1042" />            {/* variant "stack": auto back button */}
  ...
</Screen>

<Screen>
  <AppHeader
    variant="dashboard"                                                  // navy bar (tone="teal" for teal)
    overline="Sales"
    title="Dashboard"
    actions={[
      { icon: "notifications-outline", accessibilityLabel: "Notifications", badge: unread, onPress: openInbox },
      { icon: "menu-outline", accessibilityLabel: "Open menu", onPress: () => drawerNavRef.open() },
    ]}
  />
</Screen>

<AppHeader variant="brand" overline={greeting()} title={user.name} actions={[...]} />  // logo + greeting
```

`AppHeader` props: `variant` (`"brand" | "stack" | "dashboard"`, default stack), `title`, `subtitle`, `overline`,
`showBack` (auto for stack: shown when the nearest stack has a screen below), `onBack` (default goBack),
`actions: HeaderAction[]` (`{ icon, onPress, accessibilityLabel, badge?, dot?, disabled? }`), `right`, `left`,
`showLogo`, `tone` (`"navy" | "teal"`), `safeArea` (`"auto"`: no double inset inside `<Screen>`), `bordered`, `style`.

`Screen` props: `style`, `edges` (default all), `backgroundColor`, `statusBarColor`, `statusBarStyle`.
Legacy `Header`, `HomeHeader` and `DashboardHeader({ role, title, subtitle?, actions?, showMenu?, onMenuPress? })`
still work and now render AppHeader.

---

## 4. Components

### Button / IconButton

```tsx
<Button title="Book now" onPress={book} />                                      // primary, md (48dp)
<Button title="Save" loading={saving} disabled={!valid} leftIcon="checkmark" />
<Button title="Cancel booking" variant="danger" />
<Button title="Edit" variant="outline" size="sm" leftIcon="create-outline" />
<Button title="View all" variant="ghost" rightIcon="chevron-forward" />
<Button title="Continue" size="lg" fullWidth />
<IconButton icon="share-outline" accessibilityLabel="Share quotation" onPress={share} />
```

Variants `primary | secondary | outline | ghost | danger`; sizes `sm 36 | md 48 | lg 54` (sm gets hitSlop to 44).
IconButton variants `plain | tonal | outline | onDark | primary`; props `badge`, `dot`, `size`, `color`.

### TextField

```tsx
const emailRef = useRef<TextInput>(null);
<TextField label="Full name" required value={name} onChangeText={setName}
  returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={errors.name} />
<TextField ref={emailRef} label="Email" leftIcon="mail-outline" keyboardType="email-address"
  autoCapitalize="none" helperText="We send the receipt here" />
<TextField label="Password" secureTextEntry />                       // eye toggle with "Show password" label
<TextField label="Notes" multiline rows={4} />
```

Props: all `TextInput` props plus `label`, `required`, `helperText`, `error`, `disabled`, `leftIcon`, `rightIcon`,
`onRightIconPress`, `rightIconLabel`, `rows`, `containerStyle`, `inputStyle`. The ref is the `TextInput`.

### SelectField (alias PickerField) and DateField

```tsx
<SelectField label="Location" required value={locationId} onChange={setLocationId}
  options={locations.map(l => ({ label: l.name, value: l.id, description: l.city }))}
  searchable loading={loadingLocations} error={errors.location} />

<DateField label="Start date" required value={start} onChange={setStart} minimumDate={new Date()} />
<DateField label="Follow-up" mode="datetime" value={at} onChange={setAt} onClear={() => setAt(null)} />
```

SelectField opens a BottomSheet (search box appears automatically above 8 options). DateField opens the Material 3
Android dialog, which follows the app's light / dark choice. `value` accepts Date, ISO string or null.

### Card, ListRow, InfoRow, SectionHeader, Divider

```tsx
<SectionHeader title="Recent bookings" actionLabel="See all" onAction={openAll} />
<Card>
  <InfoRow label="Space" value={b.spaceName} icon="business-outline" />
  <InfoRow label="Dates" value={formatDateRange(b.startDateTime, b.endDateTime)} />
  <InfoRow label="Status" value={<StatusPill status={b.bookingStatus} />} />
  <Divider spacing={8} />
  <InfoRow label="Total" value={formatMoney(b.totalAmount)} emphasize />
</Card>

<Card padding={0}>
  <ListRow leftIcon="person-outline" title="Edit profile" onPress={edit} />
  <Divider inset={68} />
  <ListRow avatar={{ name: c.fullName }} title={c.fullName} subtitle={c.email}
    right={<StatusPill status={c.status} />} onPress={() => open(c)} />
  <ListRow leftIcon="log-out-outline" title="Log out" destructive onPress={logout} />
</Card>
```

Card: `variant` (`elevated | outlined | filled`), `padding` (default 16), `onPress`. ListRow: `title`, `subtitle`,
`meta`, `leftIcon`, `leftIconTone`, `avatar`, `left`, `right`, `chevron`, `onPress`, `destructive`, `disabled`.
InfoRow: `label`, `value` (text or element), `icon`, `layout` (`inline | stacked`), `emphasize`, `valueColor`.

### StatCard (alias KpiCard)

```tsx
<View style={{ flexDirection: "row", gap: 12 }}>
  <StatCard label="Bookings" value={12} icon="calendar-outline" sub="3 this week" onPress={openBookings} />
  <StatCard label="Outstanding" value={formatMoney(due, { compact: true })} tone="warning"
    icon="receipt-outline" trend={{ direction: "up", label: "+8% vs last month", upIsGood: false }} />
</View>
<StatCard label="Revenue" value="" loading />
```

### SegmentedControl, Chip, FilterChips, Badge, Avatar

```tsx
<SegmentedControl value={tab} onChange={setTab}
  options={[{ label: "Upcoming", value: "upcoming" }, { label: "History", value: "history" }]} />

<FilterChips value={status} onChange={setStatus}
  options={[{ label: "All", value: "all" }, { label: "Pending", value: "pending", count: 4 }]} />
<FilterChips multiple value={types} onChange={setTypes} options={typeOptions} />
<Chip label="Meeting room" selected onRemove={clear} />

<Badge count={unread} />          // hidden at 0, "99+" above 99
<Avatar name="Ahmad Amin" uri={photoUrl} size={48} />
```

### Loading, empty and error states

```tsx
<LoadingState message="Loading quotation" />
<ListSkeleton rows={5} />                 // variant "card" (default) or "rows"
<KpiSkeleton count={4} />
<EmptyState icon="calendar-outline" title="No bookings yet" message="Book a desk or a room to see it here."
  actionLabel="Book a space" onAction={goBook} />
<ErrorState message={error} onRetry={load} />
```

### AsyncList

FlatList with loading skeleton, pull-to-refresh, empty, error + retry and guarded paging built in.

```tsx
<AsyncList
  data={items}
  keyExtractor={q => String(q.id)}
  renderItem={({ item }) => <QuotationCard quotation={item} />}
  loading={loading}                 // first load, no data yet: skeleton
  refreshing={refreshing}
  onRefresh={refresh}               // enables pull-to-refresh; default retry action
  error={error}                     // no data: ErrorState; with data: inline "Retry" row
  hasMore={page * PAGE_SIZE < total}
  loadingMore={loadingMore}
  onEndReached={loadNextPage}       // never fires while loading / refreshing / error / !hasMore
  empty={{ icon: "document-text-outline", title: "No quotations", message: "Create one from a customer." }}
  ListHeaderComponent={<FilterChips ... />}
/>
```

Extra props: `onRetry`, `skeleton`, `skeletonRows`, `padding` (16), `gap` (12). All other FlatList props pass through.

### Toast (replaces `Alert.alert` for non-blocking messages)

```tsx
const toast = useToast();
toast.success("Booking confirmed");
toast.error("Could not save. Check your connection.");
toast.info("Quotation sent", { title: "Done", action: { label: "View", onPress: openQuotation } });
toast.hide();
```

One toast at a time (a new one replaces the current), 3 s (errors 4.5 s), tap to dismiss, announced to
screen readers, positioned above the tab bar. Toasts render under native Modals; inside a BottomSheet or dialog,
show inline errors instead. Keep `ConfirmDialog` / `Alert` for questions that need an answer.

### BottomSheet and ConfirmDialog

```tsx
<BottomSheet visible={open} onClose={() => setOpen(false)} title="Filter bookings"
  footer={<><Button title="Reset" variant="outline" style={{ flex: 1 }} onPress={reset} />
            <Button title="Apply" style={{ flex: 1 }} onPress={apply} /></>}>
  <SelectField ... />
</BottomSheet>

<ConfirmDialog visible={confirming} title="Cancel this booking?" message="This cannot be undone."
  confirmLabel="Cancel booking" cancelLabel="Keep booking" destructive loading={cancelling}
  onConfirm={cancelBooking} onCancel={() => setConfirming(false)} />
```

BottomSheet props: `title`, `subtitle`, `overline`, `footer`, `scrollable` (false when the child is a FlatList),
`dismissible` (false while saving), `showClose`, `maxHeight`, `fullHeight`, `contentStyle`.
Legacy `ConfirmModal` keeps its API (`confirmText`, `cancelText`) and gains `destructive`, `loading`, `icon`.

### AppearanceSetting (Profile screens)

```tsx
<Card><AppearanceSetting /></Card>     // System / Light / Dark, saved on the device
```

### Formatters (`src/utils/format.ts`)

```ts
formatMoney(12500)                       // "PKR 12,500"
formatMoney(12500.5)                     // "PKR 12,500.50"
formatMoney(1250000, { compact: true })  // "PKR 1.25M"
formatMoney(null)                        // em dash
formatNumber(1234.5, 1)                  // "1,234.5"
formatDate("2026-10-12")                 // "12 Oct 2026" (date-only strings are local, no off-by-one)
formatDate(d, { weekday: true, year: false }) // "Mon, 12 Oct"
formatTime(d)                            // "3:45 PM"
formatDateTime(d)                        // "12 Oct 2026, 3:45 PM"
formatDateRange(start, end)              // "12 – 14 Oct 2026"
formatRelative(d)                        // "Just now", "5 min ago", "Yesterday", "in 3 days", then a date
toYmdLocal(new Date())                   // "2026-10-12"
```

---

## 5. Notes for the navigation owners (files Phase 3 does not edit)

1. Pass the theme to every container: `const navTheme = useNavigationTheme(); <NavigationContainer theme={navTheme}>`
   (AppNavigator.tsx, AdminStack.tsx, SaleStack.tsx).
2. Remove `statusBarStyle: "dark"` (and `statusBarTranslucent`) from native-stack `screenOptions`. When any screen
   sets a status-bar option, react-native-screens takes over the icon colour on every transition, which gives dark
   icons on dark headers and in dark mode. `Screen` / `AppHeader` already manage the status bar.
3. Remove the `StatusBar.setBackgroundColor(colors.background)` effects; App.tsx sets the base status bar.
4. Tab bar / drawer: use `colors.tabBar`, `colors.primary` (active), `colors.tabInactive`, `colors.surface`,
   `colors.border` so they follow dark mode.

---

## 6. Dark-mode checklist when restyling a screen

- No hex / rgba literals in screens: `"#fff"` -> `colors.surface`, `"#0D5B5F"` -> `colors.headerBg` or `primaryStrong`,
  `"#64748b"` -> `colors.textMuted`, status colours -> `<StatusPill>` / `useTones()`.
- Do not import the static `colors` object; use `useThemeColors()` / `useThemedStyles()`.
- `colors.white` is white in both modes: use it only for text/icons on teal or navy fills, never as a background.
- White text goes on `primaryStrong` / `dangerStrong` / `headerBg`, not on `primary`.
- Pass `placeholderTextColor={colors.placeholder}` to raw `TextInput`s (or use `TextField`).
- Prefer `useTheme().shadows` over the static `shadows` and keep a `border` on cards (shadows are faint in dark mode).
- Replace `Alert.alert("Saved")`-style notices with `useToast()`; keep dialogs for decisions.
- Text sizes from `typography`; weights 400-700 only; minimum 12 (overline 11).
