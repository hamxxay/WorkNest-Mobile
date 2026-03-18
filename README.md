# WorkNestMobile

WorkNestMobile is a React Native mobile application for browsing, booking, and managing flexible workspaces. It includes customer-facing flows for onboarding, authentication, workspace discovery, booking, pricing, gallery browsing, and profile management, plus an admin panel for operational visibility across users, spaces, bookings, payments, contacts, memberships, and gallery items.

This project uses the React Native Community CLI and targets Android and iOS.

## What the app does

The app is built around a workspace-booking experience:

- First-run onboarding with persisted completion state.
- Login and signup against a backend API.
- Home dashboard with quick entry points into booking, pricing, and gallery.
- Workspace listing and filtering by search, type, location, and availability.
- Workspace detail and booking flow.
- Booking creation through backend APIs.
- Pricing plan browsing.
- Gallery browsing for workspace imagery.
- Profile view with booking summary.
- Admin dashboard with entity browsing and search for operational data.

## Main user flows

### Authentication flow

1. App launches into `Splash`.
2. Onboarding completion is checked from AsyncStorage.
3. If onboarding is incomplete, the user is sent to `Onboarding`.
4. If onboarding is complete, the app checks whether a session exists.
5. Authenticated users go to the app stack, unauthenticated users go to `Login`.

### Main app flow

- `Home` shows a hero section, gallery preview, and pricing preview.
- `Booking` loads workspace inventory from the API and lets users filter/search results.
- Selecting a workspace opens details and booking-related screens.
- `Pricing` pulls plans from the backend.
- `Gallery` pulls image data from the backend.
- Drawer navigation provides access to `Profile`, `Booking History`, `Privacy Policy`, and `About Us`.

### Admin flow

- Admin access is derived from the authenticated user payload in `AuthContext`.
- `AdminPanel` is protected in-app by role checks.
- Admin views include:
  - Dashboard summary
  - Users
  - Locations
  - Space Types
  - Spaces
  - Bookings
  - Pricing Plans
  - Memberships
  - Payments
  - Contacts
  - Gallery

## Tech stack

- React 19
- React Native 0.84
- TypeScript
- React Navigation 7
- Redux Toolkit
- React Redux
- AsyncStorage
- React Native Keychain
- React Native Vector Icons
- React Native SVG
- React Native Reanimated / Worklets
- React Native DateTimePicker
- React Native Picker
- Jest + React Test Renderer

## Project structure

```text
mobile-cli/
  android/                 Android native project
  ios/                     iOS native project
  public/                  Static images used by the app
  src/
    assets/                Bundled asset registry helpers
    components/            Shared UI components
    config/                API config and feature flags
    context/               Auth context and session hydration
    navigation/            Root, auth, app, tab, and drawer navigation
    screens/
      Auth/                Splash, onboarding, login, signup
      App/                 Home, booking, pricing, gallery, profile, admin, etc.
    services/              API client and domain service wrappers
    store/                 Redux store and slices
    utils/                 Storage, media URL, and validation helpers
  __tests__/               Basic app render test
  App.tsx                  App providers and navigator mount
  index.js                 React Native entry file
  package.json             Scripts and dependencies
  .env                     Runtime API base URL for `react-native-dotenv`
```

## Navigation design

The app uses nested navigators:

- Root stack
  - `Splash`
  - `Onboarding`
  - `AuthStack`
  - `AppStack`
- Auth stack
  - `Login`
  - `Signup`
- App stack
  - `MainTabs`
  - `AdminPanel`
  - `SpaceDetail`
  - `BookingInfo`
  - `Payment`
- Main tabs
  - `Home`
  - `Booking`
  - `Pricing`
  - `Gallery`

Notes:

- `MyBookings` and `MyPayments` exist in navigation types and screen files, but their bottom-tab entries are currently commented out in `src/navigation/AppNavigator.tsx`.
- Drawer navigation wraps the main tab experience and exposes additional informational/account screens.

## State management

The app uses two main state patterns:

- Local screen state for most UI interactions.
- Redux Toolkit for app-level store setup.

Current Redux usage is intentionally light:

- `src/store/store.ts` wires the store.
- `src/store/slices/appSlice.ts` currently stores only `isHydrated`.

Most functional state today lives in component state plus `AuthContext`.

## Authentication and session handling

Session handling is split across secure storage and local storage:

- Access token: stored in Keychain under `auth_token`.
- Refresh token: stored in Keychain under `auth_refresh_token`.
- User object: stored in AsyncStorage under `auth_user`.
- Onboarding state: stored in AsyncStorage under `@worknest/onboarding_complete`.

Important behavior:

- Legacy AsyncStorage token values are migrated into Keychain if found.
- `isAuthenticated()` returns true when either a token or stored user exists.
- `AuthProvider` loads cached user data first, then attempts to hydrate the session from `/auth/me`.
- Admin access is inferred from `isAdmin`, `role`, `userType`, `userRole`, or `roles`.

## Backend integration

The app talks to a REST API using `fetch` via a shared `apiRequest()` helper in `src/services/apiClient.ts`.

### API base URL resolution

`src/config/api.ts` resolves the base URL in this order:

1. `API_BASE` from `.env`
2. Development fallback inferred from Metro host
3. Android emulator fallback: `http://10.0.2.2:3000/api`
4. iOS simulator fallback: `http://localhost:3000/api`

The project is currently configured to read `API_BASE` from `.env` through `react-native-dotenv`.

### API endpoint map

#### Auth

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `POST /auth/logout`

#### Customer app

- `GET /space`
- `POST /booking`
- `GET /booking/my`
- `PATCH /booking/:id/cancel`
- `GET /pricingplan`
- `GET /gallery`
- `GET /payment/my`

#### Admin

- `GET /dashboard/summary`
- `GET /booking/recent?limit=:limit`
- `GET /contact/recent?limit=:limit`
- `GET /user`
- `GET /location/all`
- `GET /spacetype/all`
- `GET /pricingplan/all`
- `GET /gallery/all`
- `GET /membership`
- `GET /payment`
- `GET /contact`
- `GET /booking`

### Response handling

`apiRequest()` supports:

- JSON payloads
- wrapped payloads with `{ data: ... }`
- bearer token injection when `requiresAuth` is true
- `credentials: "include"` on every request
- normalized `ApiError` failures with status and details

## Domain services

### `authService.ts`

- Logs users in and signs them up.
- Saves access token when present in the auth response.
- Hydrates profile data for the session.
- `logoutUser()` currently removes only the stored access token.

### `workspaceService.ts`

- Loads workspace inventory.
- Maps backend fields into a mobile-friendly `Workspace` model.
- Creates bookings.
- Loads current user bookings.
- Cancels bookings.
- Injects demo workspace records if the API response does not include all core workspace types.

### `pricingService.ts`

- Loads pricing plans.
- Maps features and builds CTA labels.
- Flags the `Premium` plan as popular.

### `galleryService.ts`

- Loads gallery images.
- Resolves backend image paths into usable URLs.
- Infers categories from image titles.

### `paymentService.ts`

- Loads the current user payment list from `/payment/my`.

### `adminService.ts`

- Loads dashboard summary and recent activity.
- Falls back to counting raw entity lists when `/dashboard/summary` returns 404.
- Supports paginated list loading with optional search for admin entities.

## Media handling

Image rendering is handled through `SmartImage`.

Important behavior:

- Supports bundled images through an asset registry.
- Supports remote images from the API or third-party URLs.
- Falls back to a default Unsplash image if loading fails.
- `resolveMediaUrl()` converts relative backend paths into absolute URLs based on `API_BASE_URL`.
- Plain `http://` media URLs are upgraded to `https://` where possible.

## UI and design system

The app uses a simple shared theme in `src/theme.ts`.

Core palette:

- Background: `#F5F8FF`
- Foreground: `#1F2A44`
- Primary: `#4A7DFF`
- Secondary: `#365CC0`
- Accent: `#FFA726`

Shared radii:

- `sm = 10`
- `md = 16`
- `lg = 22`

## Environment setup

### Requirements

- Node.js `>= 22.11.0`
- npm
- Android Studio for Android builds
- Xcode + CocoaPods for iOS builds on macOS
- Ruby/Bundler for CocoaPods workflow

### Install dependencies

```bash
npm install
```

### Environment variables

Create or update `.env`:

```env
API_BASE=https://your-api-host/api
```

Notes:

- The code expects the base path to include `/api`.
- In development, if `API_BASE` is omitted, the app falls back to a local backend based on Metro host detection.

## Running the app

### Start Metro

```bash
npm start
```

### Run on Android

```bash
npm run android
```

### Run on iOS

```bash
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

## Available scripts

- `npm start` - start Metro
- `npm run android` - build/run Android app
- `npm run ios` - build/run iOS app
- `npm run lint` - run ESLint
- `npm test` - run Jest

## Native project details

### Android

- Namespace: `com.worknestmobile`
- Application ID: `com.worknestmobile`
- `minSdkVersion`: 24
- `compileSdkVersion`: 36
- `targetSdkVersion`: 36
- Kotlin version: `2.1.20`
- Build tools: `36.0.0`
- NDK version: `27.1.12297006`

Notes:

- Hermes is disabled in `android/app/build.gradle` via `enableHermes: false`.
- A Hermes shim script exists at `scripts/hermesc-shim.js`.
- Release signing config is present in `android/app/build.gradle`.

### iOS

- Uses the standard React Native Podfile setup with `use_react_native!`.
- Framework linkage can be toggled with `USE_FRAMEWORKS`.
- Minimum iOS target follows React Native's `min_ios_version_supported` helper.

## Testing

The project currently has a basic render smoke test:

- `__tests__/App.test.tsx`

This verifies that the root app tree renders, but it does not yet provide deep coverage for:

- auth flows
- navigation transitions
- service-layer behavior
- admin screens
- booking creation logic

## Current implementation notes and caveats

These are important for contributors to know up front:

- `src/config/featureFlags.ts` currently sets `AUTH_DISABLED = true`, but this flag is not actively used to bypass auth in the current navigation/service flow.
- `logoutUser()` removes the access token only; full cleanup is completed by `clearSession()` from `AuthContext`.
- `MyBookings` and `MyPayments` screens exist, but their tab entries are commented out.
- Several profile/admin values are still partly placeholder-style in the UI, for example the profile name and membership copy.
- The `PaymentScreen` collects card details locally but does not integrate with an external payment gateway; it ultimately creates a booking through the booking API.
- Some workspace data is normalized and supplemented with demo records when backend categories are missing.
- Admin screens are currently read-only list/search interfaces; there are no create/update/delete actions yet.
- The repo currently contains Android release signing values in Gradle config. These should be moved to secure local/CI secrets before production use.

## Recommended contributor workflow

1. Install dependencies with `npm install`.
2. Set a valid `API_BASE` in `.env`.
3. Start Metro with `npm start`.
4. Run the app on Android or iOS.
5. Validate login, gallery, pricing, booking, and admin API responses against the configured backend.

## Useful file map

- `App.tsx` - app providers and root navigator mount
- `src/navigation/AppNavigator.tsx` - navigation tree, drawer, tabs, and root flow
- `src/context/AuthContext.tsx` - user session loading and admin detection
- `src/config/api.ts` - API base resolution and endpoint definitions
- `src/services/apiClient.ts` - shared HTTP client
- `src/services/authService.ts` - auth/login/signup/session functions
- `src/services/workspaceService.ts` - workspace and booking domain logic
- `src/services/adminService.ts` - admin dashboard and entity loading
- `src/utils/authStorage.ts` - token/user persistence
- `src/utils/onboardingStorage.ts` - onboarding persistence
- `src/utils/mediaUrl.ts` - backend media URL normalization

## Troubleshooting

### API calls fail on Android emulator

If your backend runs locally, make sure the app resolves it via:

- `http://10.0.2.2:3000/api` for Android emulator
- `http://localhost:3000/api` for iOS simulator

Or set `API_BASE` explicitly in `.env`.

### Images do not load

Check:

- the configured API base URL
- whether the backend is returning relative `imageUrl` paths
- whether the backend serves image assets over HTTPS or a reachable origin

### Admin panel says you do not have permission

Ensure the hydrated user object includes one of the following:

- `isAdmin: true`
- `role: "admin"`
- `userType: "admin"`
- `userRole: "admin"`
- `roles` containing `"admin"`

## Future improvement areas

- Add stronger test coverage for booking, auth, and admin flows.
- Move all sensitive signing configuration out of source control.
- Implement real payment gateway integration.
- Expand Redux usage only where shared state is truly needed.
- Add CRUD capabilities for admin entities.
- Wire feature flags into runtime behavior or remove unused flags.

