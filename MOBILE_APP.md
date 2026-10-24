# PricePulse World mobile app

PricePulse World is being prepared as an Android app using Capacitor, reusing the existing React/Vite app and its current design.

## Build an Android APK with GitHub Actions

1. Push or merge the mobile-app setup into GitHub.
2. Open the repository's **Actions** tab.
3. Select **Build PricePulse World Android app**.
4. Select **Run workflow** when the workflow is available, then run it on the mobile-app branch.
5. Open the completed run and download the `pricepulse-world-android-debug` artifact.
6. Extract the ZIP file to get `app-debug.apk`, then transfer it to an Android phone and install it. Android may ask you to allow installation from the app you used to open the file.

The debug APK is for testing and is not a Play Store release. A signed release build, store listing, privacy policy review, and final testing are needed before publishing to Google Play.

## Build locally

Requirements: Node.js 20+, Android Studio with the Android SDK, and Java 21.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

After the Android project has been created once, use `npm run mobile:sync` to rebuild the web app and copy it into Android.

## Important product note

The mobile wrapper uses the current PricePulse World web app. Packaging it does not, by itself, add missing backend features or make sample data real. Verify authentication, price submissions, moderation, map/location permissions, and all user flows on a real device before public release.
