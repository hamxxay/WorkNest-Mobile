# Floating tab bar and screen transitions

The customer tabs (`navigation/AppNavigator.tsx`) and the staff tabs (`navigation/staff/StaffNavigator.tsx`, all
three staff roles) use one floating pill tab bar, `TabBar` (`components/ui/TabBar.tsx`). Stack transitions for both
apps come from `navigation/transitions.ts`.

```ts
import { TabBar, useTabBarSpace } from "../../components/ui";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { stackTransition, tabTransition } from "../../navigation/transitions";
```

---

## 1. What it looks like

```
             ┌──────────────────────────────────────────────┐
             │ ╭────────────╮                                │
             │ │   (home)   │   (cal)    (rcpt)  (doc)  (me) │   white pill (dark: surface), hairline border,
             │ │    Home    │                                │   theme shadow lg, 16dp side margins
             │ ╰────────────╯                                │
             └──────────────────────────────────────────────┘
                 8dp gap
  ─────────────── bottom inset (gesture handle / 3-button navigation bar) ───────────────
```

- Pill: `colors.tabBar` background, `colors.border` hairline (keeps it visible in dark mode, where shadows are
  faint), `useTheme().shadows.lg`, `radii.pill`. 64dp tall, 16dp from the sides (plus side insets in landscape),
  at most 520dp wide and centred on tablets.
- Selected tab: 1.5 tab widths, filled Ionicons glyph and its label in `colors.onPrimarySoft` on a
  `colors.primarySoft` capsule. Other tabs: outline glyph in `colors.tabInactive`, no label (the label is still the
  accessibility label).
- Moving between tabs, one shared value (the fractional index of the selected tab) drives everything on the UI
  thread: the capsule slides and stretches, the two tabs involved trade width, the outline glyph cross-fades to the
  filled one, the icon lifts and the label fades in under it. Spring with a barely visible overshoot.
- Badges: `tabBarBadge` shows the kit `<Badge>` on the icon (`99+` above 99, a dot for a non-numeric string).
- The bar slides down and fades out while the keyboard is open (`hideOnKeyboard`, default true), so search fields
  on tab roots get the whole screen.
- Reduce motion (`useReduceMotion()`): the capsule and the keyboard hide jump instead of animating.

## 2. Using it in a navigator

```tsx
const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;   // module level

<Tab.Navigator
  tabBar={renderTabBar}
  screenOptions={{ headerShown: false, ...tabTransition(reduceMotion), sceneStyle: { backgroundColor: colors.background } }}
>
  <Tab.Screen
    name="Bookings"
    component={BookingListScreen}
    options={{
      tabBarLabel: "Bookings",
      tabBarAccessibilityLabel: badge ? `Bookings, ${badge} waiting` : "Bookings",
      tabBarBadge: badge,                                  // number (or undefined); 0 hides it
      tabBarIcon: ({ focused, color, size }) => (
        <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size} color={color} />
      ),
    }}
  />
</Tab.Navigator>
```

Options TabBar reads: `tabBarIcon` (called twice, `focused: true` for the filled layer and `false` for the outline
layer, so always map both glyphs), `tabBarLabel` (string) or `title` or the route name, `tabBarBadge`,
`tabBarAccessibilityLabel`, `tabBarButtonTestID`. The default bar's styling options (`tabBarStyle`,
`tabBarActiveTintColor`, `tabBarLabelStyle`, `tabBarItemStyle`, `tabBarButton`, `tabBarHideOnKeyboard`, ...) are
ignored: colours come from the theme.

Tab icons in use:

| App | Tab | Selected | Not selected |
| --- | --- | --- | --- |
| Customer | Home | `home` | `home-outline` |
| Customer | Bookings | `calendar` | `calendar-outline` |
| Customer | Payments | `receipt` | `receipt-outline` |
| Customer | Agreements | `document-text` | `document-text-outline` |
| Customer | Profile | `person` | `person-outline` |
| Staff | Dashboard | `grid` | `grid-outline` |
| Staff | Inquiries (sales) | `walk` | `walk-outline` |
| Staff | Quotations (sales) | `document-text` | `document-text-outline` |
| Staff | Approvals (admin, super admin) | `checkmark-done-circle` | `checkmark-done-circle-outline` |
| Staff | Bookings (admin, super admin) | `calendar` | `calendar-outline` |
| Staff | Customers | `people` | `people-outline` |
| Staff | More | `ellipsis-horizontal-circle` | `ellipsis-horizontal-circle-outline` |

Customer tabs have no badges (the notification bell is in the header). Staff tabs show waiting counts: Inquiries,
Quotations and Bookings from `admin/nav-badges`, Approvals = pending capacity requests, More = the sum of its menu.

Behaviour matches the default bar: a press emits `tabPress` (preventable; pressing the selected tab lets
`useScrollToTop` scroll it up) and switches tab, a long press emits `tabLongPress`.

## 3. Content under the bar: `useTabBarSpace()`

The bar floats over the screen, so tab screens draw all the way down and scroll under it. `useTabBarSpace()` is the
height it covers at the bottom: bar 64 + gap 8 (12 with no inset) + `insets.bottom`. Outside a bottom-tab navigator
(pushed screens, sheets opened from them) it is 0, so shared components can always add it.

- `AsyncList` adds it to its own bottom padding (`padding`, or the bottom padding in `contentContainerStyle`), so
  every list tab is done.
- A tab root that scrolls with a `ScrollView` adds it to its content padding:

  ```tsx
  const tabBarSpace = useTabBarSpace();
  <ScrollView contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + tabBarSpace }]}>
  ```

  Done for Home, Profile, staff Dashboard and staff More.
- Anything pinned to the bottom of a tab screen moves up by it (the Home assistant button:
  `bottom: 20 + tabBarSpace`).
- Tab roots do not apply the bottom safe-area edge themselves (`<Screen edges={["top", "left", "right"]}>`, and
  `StaffScreen` drops it inside the tabs): the space already includes the inset.
- Toasts sit 80dp above the bottom inset, which clears the bar (it ends 72dp above the inset).
- `useBottomTabBarHeight()` returns the same number (TabBar reports it), for code that already uses it.

The geometry (heights, gaps, widths, the per-tab "how selected" maths) is in `tabBarMetrics.ts`, unit-tested in
`tabBarMetrics.test.ts`.

## 4. Screen transitions (`navigation/transitions.ts`)

| Kind | Animation | Used for |
| --- | --- | --- |
| `push` | `slide_from_right` | every pushed screen not listed below (details, lists, booking flow, notifications) |
| `modal` | `slide_from_bottom` | forms / tasks opened over the current page: customer `BookTour`, `AccessRequest`, `ESignAgreement`; staff `QuotationForm`, `CustomerForm`, `BookingForm`, `AgreementSend` |
| `fade` | `fade` | swaps: `MainTabs` / `StaffTabs`, `Login` / `Signup` (also when opened from inside the app), the root `Splash` / `Onboarding` / `AuthStack` / `AppStack` |
| tabs | `fade` | switching bottom tabs (`tabTransition()`) |

- Swipe back (`gestureEnabled`) is on everywhere except the root stack, whose screens are replaced and never stepped
  back to. Android's system back always works.
- Modals keep the normal card presentation (`presentation` is not changed), so `AppHeader`'s back button and the
  status-bar handling stay the same; only the animation differs.
- Reduce motion: every stack and tab transition becomes `animation: "none"`. `useReduceMotion()` starts from the
  launch value and follows changes to the system setting while the app runs.
- To make a new screen a modal form, add its route to `CUSTOMER_MODAL_ROUTES` or `STAFF_MODAL_ROUTES`; to make it
  fade, to `CUSTOMER_FADE_ROUTES`. `transitions.test.ts` lists the expected mapping.

## 5. Limits and notes

- Left-to-right layouts only: the capsule position is computed from the left edge.
- Up to 5 tabs on a 360dp phone keeps inactive tabs at 57dp (above the 44dp target); with more tabs, move some into
  a "More" tab rather than shrinking them.
- Labels follow font scaling up to 1.15x so the label stays under the icon inside the 54dp item.
- The bar hides after Android reports the keyboard as open (`keyboardDidShow`), the same timing as the default bar.
