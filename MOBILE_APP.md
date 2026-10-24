# PricePulse World mobile app

PricePulse World is being prepared for Android and iOS with Capacitor, sharing the core React app while using a more app-like mobile layout: bottom tab navigation, larger touch targets, rounded surfaces, and safe-area support. The mobile-only styles do not change the regular website layout.

## Build test packages with GitHub Actions

1. Open the repository's **Actions** tab.
2. Select **Build PricePulse World mobile apps**.
3. Choose **Run workflow** and select the `feature/android-mobile-app` branch, or push a new commit to that branch.
4. When the run finishes, open it and download the artifact you need.

### Android
Download `pricepulse-world-android-debug`, extract the ZIP, and install `app-debug.apk` on an Android phone for testing. Android may ask you to allow installation from the app used to open the file.

### iPhone / iOS
The workflow creates an **unsigned iOS Simulator app** for build verification, not an installable iPhone IPA. Running on a physical iPhone or publishing through TestFlight/App Store requires Apple signing and provisioning, normally through an Apple Developer account and App Store Connect. We will configure that release path separately.

## Build locally

Requirements: Node.js 20+, Android Studio and Android SDK for Android, and a Mac with Xcode for iOS.

```bash
npm install
npm run build

# Android (on a machine with Android Studio/SDK)
npx cap add android
npx cap sync android
npx cap open android

# iOS (on macOS with Xcode)
npx cap add ios
npx cap sync ios
npx cap open ios
```

After the native project has been generated once, run `npm run mobile:sync` to rebuild the web app and sync the native projects.

## Design direction

**Premium Green + Fresh Modern** — a friendly, polished shopping companion, not a banking interface.

- Deep forest green, fresh green accents, warm white surfaces, and soft neutral backgrounds.
- A welcoming onboarding screen with clear customer, shop-owner, and guest choices.
- A bold but readable home hero, a simple product search, category shortcuts, and calm, rounded cards.
- Friendly copy such as “Find the right price. Shop with confidence.”, “What are you looking for?”, “Find prices”, and “Share a price”.
- Native-feeling bottom navigation for Home, Explore, Shops, Saved, and Account.
- Comfortable touch targets, readable 16px mobile inputs, and safe-area spacing for Android and iPhone.
- The mobile-only visual styles stay scoped to native app mode; the website layout is not redesigned by those styles.

## Release readiness

The mobile wrapper reuses the current app; packaging does not automatically make sample data real or verify every feature. Before public release, test sign-in and session recovery, price submissions and approval, shop verification, messages, location permissions, maps, offline/error states, and all flows on physical devices. Debug APKs and unsigned simulator builds are for development only, not store release builds.
