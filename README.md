# WorkNestMobile

WorkNestMobile is a React Native mobile application for browsing, booking, and managing flexible workspaces. It includes customer-facing flows for onboarding, authentication, workspace discovery, booking, pricing, gallery browsing, and profile management, plus an admin panel for operational visibility.

----------------------------------------
# WHAT THE APP DOES

- Onboarding with persisted state
- Login and signup via Firebase Authentication
- Google login with Firebase
- Home dashboard with booking, pricing, and gallery
- Workspace search and filtering
- Booking flow
- Pricing plans
- Gallery browsing
- Profile with booking summary
- Admin dashboard for system data

----------------------------------------
 
# MAIN FLOWS

Authentication:
Splash → Onboarding (if needed) → Login → App

Main App:
Home → Booking → Workspace Detail → Booking → Payment
Also includes Pricing and Gallery

Admin:
Dashboard + Users + Spaces + Bookings + Payments + etc.

----------------------------------------

# TECH STACK

- React Native
- TypeScript
- React Navigation
- Redux Toolkit
- AsyncStorage
- Secure storage
- Reanimated
- Jest

----------------------------------------

# PROJECT STRUCTURE

mobile-cli/
  android/
  ios/
  public/
  src/
    assets/
    components/
    config/
    context/
    navigation/
    screens/
    services/
    store/
    utils/
  __tests__/
  App.tsx
  index.js
  package.json

----------------------------------------

# STATE MANAGEMENT

- Local state for UI
- Redux Toolkit (minimal)
- Auth via Context
- Firebase Authentication for email/password and Google sign-in

----------------------------------------

# AUTH & SESSION

- Tokens stored securely
- User stored locally
- Session restored on app launch
- Admin role inferred from user data

----------------------------------------

# BACKEND

- REST API via fetch wrapper
- Base URL from environment variable

Endpoints include:
- Auth
- Booking
- Spaces
- Pricing
- Gallery
- Payments
- Admin data

----------------------------------------

# SERVICES

- Auth
- Workspace & Booking
- Pricing
- Gallery
- Payments
- Admin

----------------------------------------

# MEDIA HANDLING

- Local and remote images supported
- URL normalization
- Fallback images

----------------------------------------

# ENVIRONMENT SETUP

Requirements:
- Node.js
- npm
- Android Studio / Xcode

Install:
npm install

Set environment:
API_BASE=<your-backend-url>
FIREBASE_WEB_CLIENT_ID=<firebase-web-client-id>
FIREBASE_IOS_CLIENT_ID=<optional-ios-client-id>
ANDROID_FIREBASE_PROJECT_NUMBER=<firebase-project-number>
ANDROID_FIREBASE_PROJECT_ID=<firebase-project-id>
ANDROID_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
ANDROID_FIREBASE_MOBILE_SDK_APP_ID=<android-mobile-sdk-app-id>
ANDROID_FIREBASE_PACKAGE_NAME=com.worknestmobile
ANDROID_FIREBASE_API_KEY=<android-firebase-api-key>
ANDROID_FIREBASE_ANDROID_CLIENT_ID_DEBUG=<debug-android-oauth-client-id>
ANDROID_FIREBASE_ANDROID_CLIENT_ID_RELEASE=<release-android-oauth-client-id>
ANDROID_FIREBASE_DEBUG_CERT_HASH=<debug-sha1>
ANDROID_FIREBASE_RELEASE_CERT_HASH=<release-sha1>
ANDROID_UPLOAD_STORE_FILE=<release-keystore-file>
ANDROID_UPLOAD_KEY_ALIAS=<release-key-alias>
ANDROID_UPLOAD_STORE_PASSWORD=<release-keystore-password>
ANDROID_UPLOAD_KEY_PASSWORD=<release-key-password>

Firebase setup:
- Run `npm run sync:config` to generate local native config files from `.env`
- Do not commit `android/app/google-services.json`, `android/keystore.properties`, or `GoogleService-Info.plist`
- Add `GoogleService-Info.plist` locally to the Xcode target
- Enable Google provider in Firebase Authentication
- Enable Email/Password provider in Firebase Authentication
- For Android Google Sign-In, add both the debug and release SHA-1/SHA-256 fingerprints to the Firebase Android app, then update the matching Android Firebase values in `.env`
- For iOS, add the `REVERSED_CLIENT_ID` from `GoogleService-Info.plist` as a URL scheme in Xcode

----------------------------------------

# RUNNING THE APP

npm start
npm run android
npm run ios

----------------------------------------

# NOTES

- Payment is not integrated with real gateway
- Admin is read-only
- Some data may be mocked
- Feature flags may be unused
- Firebase client configuration is build-injected from `.env`, but mobile client config is still discoverable in a shipped app; true secrets must stay on the server

----------------------------------------

# FUTURE IMPROVEMENTS

- Add test coverage
- Secure configs
- Integrate payment gateway
- Add admin CRUD
