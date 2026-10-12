# Empty and error state illustrations

Flat illustrations for empty lists, empty sections and failed loads, drawn with `react-native-svg` in the theme
colours. They follow light and dark mode automatically. Code: `src/components/illustrations/`.

```tsx
import { EmptyState, ErrorState, AsyncList } from "../../components/ui";

<EmptyState illustration="calendar" title="No bookings yet" message="Book a desk or a room to see it here."
  actionLabel="Book a space" onAction={goBook} />

<ErrorState message={error} onRetry={load} />                          // cloud-off by default

<AsyncList ... empty={{ illustration: search ? "search" : "receipt", title: "No invoices yet" }} />
```

## The set

| Name | Drawing | Use for |
| --- | --- | --- |
| `calendar` | month grid, one day highlighted | no bookings (upcoming or past) |
| `receipt` | receipt with a torn edge and a coin | no payments, invoices or challans |
| `document` | page with a folded corner and a signature | no agreements, quotations, KYC documents |
| `people` | two people and an "add" badge | no customers, attendants, users; "choose a customer" |
| `bell` | quiet bell with "z z" | no notifications, all caught up |
| `search` | magnifier with a question mark | no results while a search or filter is active |
| `inbox` | empty tray and a waiting chat bubble | no inquiries, complaints, requests |
| `door` | closed door and a key | no access yet, verify access, no door events |
| `chart` | chart card with ghost bars and a dashed trend | no data yet, no activity |
| `cloud-off` | cloud with a slash | load failed, offline (the ErrorState default) |
| `building` | office building with a location pin | no spaces, locations, free spaces |
| `image` | stacked photos | no photos |

Pick by what the list holds, and switch to `search` while the user is searching or filtering:
`illustration: search ? "search" : "people"`. That way an empty result looks different from an empty account.

## EmptyState and ErrorState props

| Prop | EmptyState | ErrorState |
| --- | --- | --- |
| `illustration` | name from the table. Takes precedence over `icon` | name. Default `"cloud-off"` unless `icon` is set |
| `icon` | Ionicons name in a small tinted well, used when there is no illustration. Default `"file-tray-outline"` | Ionicons name in a small danger well, shown instead of the default illustration |
| `illustrationSize` | dp. Default 140, or 96 with `compact` | same |

- `icon` still works on its own, so older call sites keep their look.
- `compact` (states inside cards, sheets and pickers) uses a 96dp drawing.
- An error that is not really a failure can name its subject. For example, the challan screen shows
  `illustration={error ? "cloud-off" : "receipt"}` when a booking simply has no challan yet.
- `AsyncList` passes `empty` straight to `EmptyState`, so `empty={{ illustration: ... }}` works there too. Its
  error state is an `ErrorState`, so it shows cloud-off.

## Accessibility

The drawings are decorative. The `Svg` (and the icon well, when one is shown) has
`accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`, so TalkBack and VoiceOver
skip it and read the title (a header in EmptyState) and the message. Do not put information only in the picture.

For a picture that carries meaning on its own, pass a label. It is then announced as an image:

```tsx
<Illustration name="door" accessibilityLabel="Door locked" />
```

## Using one directly

```tsx
import { Illustration, illustrations, ILLUSTRATION_NAMES, isIllustrationName,
  DoorIllustration, type IllustrationName } from "../../components/illustrations";

<Illustration name="chart" size={120} />            // by name
<DoorIllustration size={96} />                       // by component
const Drawing = illustrations["bell"];               // the name map: Record<IllustrationName, component>
if (isIllustrationName(fromApi)) { ... }             // names that come from data or route params
```

Props: `size` (dp, default 140), `accessibilityLabel`, `style`, `testID`.

## Colours

Every drawing uses only these eight colours. `illustrationPalette(colors, isDark)` builds them from the active
theme, so no screen or drawing has a hex code.

| Palette key | Theme token | Light | Dark |
| --- | --- | --- | --- |
| `backdrop` | `primarySoft` | teal-100 | teal-400 at 14% |
| `surface` | `surfaceRaised` | white | night raised |
| `ink` (outlines) | `text` / `textSecondary` | navy slate-900 | slate-300 |
| `accent` | `brand` | teal-600 | teal-600 |
| `accentSoft` | `primarySoft` | teal-100 | teal-400 at 14% |
| `onAccent` | `white` | white | white |
| `muted` (placeholders) | `borderStrong` | slate-300 | slate-700 |
| `alert` (cloud-off slash) | `danger` | red-600 | red-400 |

## Adding an illustration

1. Draw it on the shared 160 x 160 grid. `createIllustration` already paints the backdrop disc (centre 80,84,
   radius 64). Keep the subject inside about x 28-132, y 24-132, with sparkles and dots in the corners.
2. Style: outlines `{...outline(p)}` (ink, 3 wide, round caps and joins). One teal accent area, and placeholder
   bars in `p.muted` with `rx` = half their height. Add a `Sparkle` (accent) and one or two `Dot`s. Use palette
   keys only, no hex codes.
3. Create `src/components/illustrations/<Name>.tsx`:

   ```tsx
   export const RocketIllustration = createIllustration("RocketIllustration", (p) => (
     <>
       <Sparkle x={30} y={48} r={7} fill={p.accent} />
       <Path d="..." fill={p.surface} {...outline(p)} />
     </>
   ));
   ```

4. Add the name to `ILLUSTRATION_NAMES` (`names.ts`), the entry to `illustrations` (`map.ts`; TypeScript reports a
   missing entry), and the export to `index.ts`.
5. Run `npx jest src/components/illustrations`. The test renders every name in light and dark mode. It fails if a
   drawing uses a colour that is not from the palette, or if the name map and the names list differ.

## Where they are used

| Illustration | Customer screens | Staff screens |
| --- | --- | --- |
| calendar | My bookings (upcoming, history, signed out) | Bookings |
| receipt | Payments (list, signed out), Challan (no challan yet) | Invoices, Customer detail (invoices) |
| document | Quotations, Agreements (list, signed out) | Quotations, Agreements, Customer detail (quotations), KYC customer (documents, versions) |
| people | | Customers, KYC, Users, Attendants (choose a customer), Room access, customer picker |
| bell | Notifications (list, signed out) | Notifications |
| search | Spaces (filters on) | search or filter results on Customers, KYC, Users, Bookings, Invoices, Quotations, Complaints, Spaces, customer picker; Challan validity (no match) |
| inbox | | Inquiries, Complaints, Capacity requests |
| door | Unlock door (verify access) | Access activity (door events) |
| chart | | Access activity (sync) |
| cloud-off | every ErrorState (default) | every ErrorState (default) |
| building | Spaces, Home (no spaces open) | Spaces, Locations, Attendants (no booked space), Booking detail (no free spaces) |
| image | Gallery | |

The "Tour requested" confirmation on Book a tour keeps its checkmark icon: it is a success message, not an empty
state.
