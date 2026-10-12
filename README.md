# WorkNest Mobile

Android and iOS app for [WorkNest](https://worknestpk.com) coworking spaces. One app serves customers and staff: after sign-in the app picks a navigator based on the user's role.

Built with React Native 0.86, React 19 and TypeScript. All data comes from the WorkNest API (`WN_APIs`).

## What the app does

### Customers (default role)

| Area | What it does | Screens |
|---|---|---|
| Home | Spaces, search, quick access tiles, notifications | `HomeScreen`, `SpaceDetailScreen`, `NotificationsScreen` |
| Bookings | Search and book spaces, view and modify bookings, manage attendees | `BookingScreen`, `BookingInfoScreen`, `MyBookingsScreen`, `BookingDetailScreen`, `ModifyOrderScreen`, `AttendeesScreen` |
| Quotations | View quotations, accept and pay, share | `QuotationListScreen`, `QuotationScreen`, `QuotationPaymentScreen`, `ShareQuotationScreen` |
| Invoices and payments | Invoice list with PDFs, payment challans (save, share, print) | `MyPaymentsScreen`, `ChallanScreen`, `PaymentScreen`, `CustomerInfoScreen` |
| Agreements | List agreements, open the PDF, sign in the app (e-sign) | `AgreementListScreen`, `ESignAgreementScreen` |
| Door access | Request access to your room door; once approved, the Home tile becomes **Unlock Door** and opens the room door in one tap | `AccessRequestScreen`, `UnlockDoorScreen`, `hooks/useUnlockRoomDoor.ts` |
| Account and info | Profile, pricing, gallery, contact, about, user manual, privacy policy | `ProfileScreen`, `PricingScreen`, `GalleryScreen`, ... |

Guests can browse spaces and pricing. Bookings, invoices and door access ask the user to sign in.

### Staff (sales executive and admin)

| Area | What it does | Screens |
|---|---|---|
| Dashboard | Totals for customers, bookings, quotations, tour inquiries; quotation status (draft, sent, accepted, declined) | `SaleDashboard` (sales), `AdminDashboard` (admin) |
| Customers | Create customers and browse the customer list | `CustomerCreateScreen`, `CustomerListScreen` |
| KYC | Upload and view a customer's KYC documents | `KycDocumentsScreen` |
| Quotations | Create and list quotations | `SaleQuotationCreateScreen`, `SaleQuotationListScreen` |
| Bookings | Create and list bookings for customers | `SaleBookingCreateScreen`, `SaleBookingListScreen` |
| Tour inquiries | Follow up on "Book a Tour" requests from the website | `TourInquiriesScreen` |

### Role routing

`src/navigation/RootNavigator.tsx` reads the role from `AuthContext`:

| Role from the API | Navigator |
|---|---|
| `admin` / `super_admin` | `AdminStack` |
| `sales_executive` | `SaleStack` |
| anything else | `AppNavigator` (customer app) |

## Tech stack

- React Native 0.86 (Hermes enabled), React 19.2, TypeScript 5
- React Navigation 7 (native stack, bottom tabs, drawer)
- Redux Toolkit for app state, `AuthContext` for the session
- Firebase Auth and Google Sign-In; Firebase Messaging for push
- `react-native-keychain` for the token, AsyncStorage for small settings
- `react-native-dotenv` for configuration (`import { API_BASE } from "@env"`)
- Reanimated 4, Gesture Handler, SVG, vector icons
- `react-native-html-to-pdf`, `react-native-view-shot`, `react-native-share` for challans, quotations and agreements
- Jest, ESLint, Prettier

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
npx tsc --noEmit -p .    # type-check
npm run lint             # ESLint
npm test                 # Jest
```

## Release build (Android)

App ID `com.worknestmobile`. Bump `versionCode` and `versionName` in `android/app/build.gradle` before each release.

```bash
npm run sync:config
cd android
./gradlew assembleRelease    # APK: android/app/build/outputs/apk/release/
./gradlew bundleRelease      # AAB for Play Store: android/app/build/outputs/bundle/release/
```

Release signing reads `android/keystore.properties` (keys listed in `android/keystore.properties.example`). If that file is missing the release build is signed with the debug keystore, which is fine for testing but cannot be uploaded to the Play Store.

`hermesCommand` in `android/app/build.gradle` points to `scripts/hermesc-shim.js`, which copies the JS bundle as-is instead of compiling it to Hermes bytecode.

## Project structure

```
App.tsx, index.js         app entry
src/
  navigation/             RootNavigator (role switch), AppNavigator (customer), SaleStack, AdminStack, linking
  screens/
    Auth/                 splash, onboarding, login, signup
    App/General/          customer screens (bookings, quotations, invoices, agreements, door access, ...)
    App/Sales/            staff screens (dashboard, customers, KYC, quotations, bookings, tour inquiries)
    App/Admin/            admin dashboard
  services/               one file per API area; apiClient.ts handles auth headers and errors
  config/api.ts           API base URL and endpoint paths
  context/AuthContext.tsx session and role
  hooks/                  useDoorAccess, useUnlockRoomDoor
  components/             shared UI (Screen, Header, ConfirmModal, Skeleton, ...)
  store/                  Redux Toolkit store and slices
  utils/                  storage, validation, phone and CNIC helpers, PDF helpers
  types/env.d.ts          types for the variables in .env
scripts/                  sync-native-config.js, hermesc-shim.js
android/, ios/            native projects
public/                   Firebase Hosting page and app-link files (.well-known)
```

## Related repositories

| Repo | What it is |
|---|---|
| `WN_APIs` | WorkNest API used by this app and the web portal |
| `WorkNest_FE` | Staff web portal (CMS) |
| `WorkNest-MainWeb` | Public website, worknestpk.com |
