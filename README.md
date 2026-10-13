# WorkNest Mobile

Android and iOS app for [WorkNest](https://worknestpk.com) coworking spaces. One app serves customers and staff: after sign-in the app picks a navigator based on the user's role.

Built with React Native 0.86, React 19 and TypeScript. All data comes from the WorkNest API (`WN_APIs`).

## What the app does

### Customers (role `general`, and guests)

Bottom tabs: **Home, Bookings, Payments, Agreements, Profile**.

| Area | What it does | Screens |
|---|---|---|
| Home | Challan waiting to be paid, quick actions (book a space, book a tour, door access, quotations), spaces open for booking, notifications, assistant | `HomeScreen`, `SpacesScreen`, `SpaceDetailScreen`, `NotificationsScreen`, `BookTourScreen` |
| Booking | Pick a space, dates and seats, live availability, confirm, then pay the bank challan (1Bill / HBL) | `BookingInfoScreen`, `BookingConfirmScreen`, `ChallanScreen` |
| Bookings tab | Upcoming and past bookings, booking detail | `MyBookingsScreen`, `BookingDetailScreen` |
| Payments tab | Payments and the challan of each booking; statuses come from the API (the app never marks anything paid) | `MyPaymentsScreen`, `ChallanScreen` |
| Quotations | View quotations from WorkNest, accept or decline, download the PDF | `QuotationListScreen`, `QuotationScreen` |
| Agreements tab | Lease agreements, read the PDF, sign in the app (drawn or typed signature) | `AgreementListScreen`, `ESignAgreementScreen` |
| Door access | Request access to your room door; once approved the Home tile opens the door | `AccessRequestScreen`, `UnlockDoorScreen` |
| Profile tab | Account details, appearance (System / Light / Dark), gallery and help pages, sign out | `ProfileScreen`, `GalleryScreen`, `ContactUsScreen`, `AboutUsScreen`, `UserManualScreen`, `PrivacyPolicyScreen` |

Guests can browse spaces, the gallery and the help pages; booking, payments, agreements and door access ask them
to sign in. Payment is by bank challan only: there is no in-app card payment.

### Staff (sales executive, admin, super admin)

Staff sign in from the same Login screen; the app then switches to the staff navigator for their role
(`src/navigation/staff`, rules in `staff/access.ts`, mirroring the web CMS).

| Role | Bottom tabs | "More" menu |
|---|---|---|
| Sales executive | Dashboard, Inquiries, Quotations, Customers, More | Bookings, Agreements, KYC, Complaints, Invoices, Attendants & Access, Profile |
| Admin | Dashboard, Approvals, Bookings, Customers, More | Quotations, Tour Inquiries, Agreements, KYC, Complaints, Invoices, Attendants & Access, Access Activity Log, Locations, Spaces, Users, Profile |
| Super admin | as admin | as admin, plus Challan Validity |

Screens live in `src/screens/App/Staff/<Area>/`; their API calls in `src/services/staff/`. Tabs show badge
counts from `GET admin/nav-badges`. Sign-out (any role) returns to the customer app.

### Role routing

`src/navigation/RootNavigator.tsx` reads the role from `AuthContext` and mounts one navigator:

| Role from the API | Navigator |
|---|---|
| `super_admin` | `SuperAdminStack` |
| `admin` | `AdminStack` |
| `sales_executive` | `SaleStack` |
| anything else (incl. receptionist, guests) | `AppNavigator` (customer app) |

The three staff stacks are `StaffNavigator` with their role. RootNavigator also registers push notifications for
every signed-in role.

### Light and dark mode

The app follows the phone's setting by default; Profile (customers and staff) has an Appearance switch
(System / Light / Dark), saved on the device. Colours, type scale and components come from the UI kit
(`src/theme`, `src/components/ui`, usage guide in `src/components/ui/README.md`). Android's own dialogs and date
pickers follow the same choice. Documents (signatures) always stay on white paper.

## Prerequisites

- Node.js 22.11 or later (`engines` in `package.json`)
- JDK 17
- Android Studio with Android SDK 36 (build tools 36.0.0) and NDK 27.1.12297006; minimum supported device is Android 7.0 (API 24)
- For iOS: macOS with Xcode, Ruby and Bundler (CocoaPods is installed through the `Gemfile`)

See the React Native [environment setup](https://reactnative.dev/docs/set-up-your-environment) guide if this is your first React Native project.

## Setup

```bash
npm ci
```

Create a `.env` file in the project root. It is kept out of git; `.env.example` lists every variable.

| Variable | Used for |
|---|---|
| `API_BASE` | WorkNest API address, read in `src/config/api.ts`. Production: `https://aeo.eaccounting360.com.pk/WorkNest/api` (also the fallback when empty). `/api` is added if missing. |
| `FIREBASE_WEB_CLIENT_ID`, `FIREBASE_IOS_CLIENT_ID` | Google Sign-In |
| `ANDROID_FIREBASE_*` | Used by `npm run sync:config` to generate `android/app/google-services.json` |
| `ANDROID_UPLOAD_*` | Optional. Used by `npm run sync:config` to generate `android/keystore.properties` for release signing |

`android/app/google-services.json`, `android/keystore.properties` and `ios/**/GoogleService-Info.plist` are not in git. Ask the team for the Firebase values, or for the files themselves.

After changing `.env`, restart Metro with `--reset-cache` so the new values are picked up.

### Using a local API on a phone over USB

Run `WN_APIs` locally on port 5200, then:

```bash
adb reverse tcp:5200 tcp:5200
adb reverse tcp:8081 tcp:8081
```

and set `API_BASE=http://127.0.0.1:5200/api`. On the Android emulator, `localhost` in `API_BASE` is rewritten to `10.0.2.2` automatically.

## Run

Start Metro in one terminal:

```bash
npx react-native start
```

In another terminal:

```bash
npx react-native run-android
npx react-native run-ios        # first time: cd ios && bundle install && bundle exec pod install
```

`npm run android` and `npm run ios` do the same but first run `npm run sync:config`, which regenerates the native Firebase and signing files from `.env` and fails if the `ANDROID_FIREBASE_*` variables are missing.

## Checks

```bash
npx tsc --noEmit -p .          # type-check
npx eslint src --ext .ts,.tsx  # lint (npm run lint lints the whole project)
npx jest                       # unit tests
```

React Native 0.86 moved its Jest preset to the separate package `@react-native/jest-preset`, which is not in
`package.json` yet. Without it, `jest.config.js` runs the TypeScript unit tests (services, staff rules, config,
roles) in Node with a small react-native stub (`jest/react-native-stub.js`) and skips the render test
`__tests__/App.test.tsx`. Install the preset (`npm i -D @react-native/jest-preset@0.86`) to run that one too;
the config picks it up automatically.

## Release build (Android)

App ID `com.worknestmobile`. Bump `versionCode` and `versionName` in `android/app/build.gradle` before each release.

```bash
npm run sync:config
cd android
./gradlew assembleRelease    # APK: android/app/build/outputs/apk/release/
./gradlew bundleRelease      # AAB for Play Store: android/app/build/outputs/bundle/release/
```

Release signing reads `android/keystore.properties` (keys listed in `android/keystore.properties.example`). If that file is missing the release build is signed with the debug keystore, which is fine for testing but cannot be uploaded to the Play Store.

The JS bundle is compiled to Hermes bytecode by the `hermesc` binary from the `hermes-compiler` package (no `hermesCommand` is set in `android/app/build.gradle`).

## Project structure

```
App.tsx, index.js           app entry: theme, toasts, confirm dialog, error boundary, RootNavigator
src/
  navigation/               RootNavigator (role switch + push), AppNavigator (customer), linking (deep links)
    staff/                  StaffNavigator, per-role access rules (access.ts), screen registry
    types.ts, staffTypes.ts route param lists
  screens/
    Auth/                   splash, onboarding, login, signup
    App/General/            customer screens (home, booking, bookings, payments, quotations, agreements, ...)
    App/Staff/<Area>/       staff screens (dashboard, inquiries, quotations, customers, bookings, KYC, ...)
    Home/                   shared space card
  services/                 customer API calls; apiClient.ts handles auth headers, errors, session expiry
    staff/                  staff API calls (one file per area) with unit tests
  components/
    ui/                     UI kit: Button, TextField, Card, StatusPill, AsyncList, AppHeader, BottomSheet, ...
    Screen.tsx, SmartImage, Skeleton, ErrorBoundary, ChatBot
  theme/                    colours (light / dark), typography, spacing, ThemeProvider, status colours
  config/api.ts             API base URL and endpoint paths
  context/                  AuthContext (session) and roles
  hooks/                    push notifications, door access
  store/                    Redux Toolkit (notifications)
  utils/                    formatting, storage, validation, phone and CNIC helpers
  types/env.d.ts            types for the variables in .env
jest/                       react-native stub for the Node test run
scripts/                    sync-native-config.js, make-app-icons.py
android/, ios/              native projects (Android res: brand colours, DayNight theme, splash colour)
public/                     logo, bundled photos, Firebase Hosting page and app-link files (.well-known)
```

## Known API gaps

Things the app works around because the API has no endpoint for them yet:

- No customer "my invoices" list: Payments shows `GET /payment/my` plus each booking's challan.
- No `GET agreement/{id}`: the staff agreement detail is opened from the list row.
- No endpoint to edit a quotation's values: editing means a new version / quotation; quotation "convert" always
  fails by design (bookings come from signed agreements).
- No "unregister device token": sign-out deletes the FCM token on the device instead.
- No "mark all announcements read": one call per announcement.
- No status / date filter on the staff booking list (search only).
- No "spaces of this location and type" lookup: the space list is filtered on the device.
- No receptionist role (`Roles.FromRow` falls back to general), so receptionists get the customer app.

## Related repositories

| Repo | What it is |
|---|---|
| `WN_APIs` | WorkNest API used by this app and the web portal |
| `WorkNest_FE` | Staff web portal (CMS) |
| `WorkNest-MainWeb` | Public website, worknestpk.com |
