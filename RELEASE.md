# Release Guide (Phase 6)

How to ship this app to the Play Store. Items marked **[you]** need your accounts
/ credentials / decisions; the rest is wired in the repo.

---

## 0. Blockers to resolve before a public release
- **[you] Ship a commercially-licensed SoundFont.** The dev build bundles
  `android/app/src/main/assets/soundfonts/florestan-subset.sf2` (a TinySoundFont
  example). Verify its license allows commercial distribution, or replace it with
  a properly-licensed grand-piano `.sf2`. Update `SOUNDFONT_ASSET` in
  `MainApplication.kt` if the filename changes, and re-check instrument preset
  numbers in `src/domain/instruments.ts` (they're specific to the current SF2).
- **[you] AdMob.** The bottom banner is a placeholder (`src/components/ads/AdBanner.tsx`).
  For real ads, add `react-native-google-mobile-ads`, your AdMob app id (manifest
  `meta-data`), and call `MobileAds().initialize()`. Use Google test ad unit IDs
  until your account/ad units are approved.
- **[you] Crash reporting.** Not yet integrated — see §5.

---

## 1. Signing
1. Generate an upload keystore (once):
   ```
   keytool -genkeypair -v -keystore android/app/release.keystore \
     -alias music -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/keystore.properties.template` → `android/keystore.properties`
   and fill in the passwords/alias. **Both files are gitignored** — never commit them.
3. With `keystore.properties` present, `release` builds are signed with it
   automatically (else they fall back to the debug keystore, which the Play Store
   will reject — fine only for local verification).
4. **[you] Recommended:** enrol in Play App Signing (Google manages the app
   signing key; your `release.keystore` becomes just the upload key).

## 2. Versioning
Bump per release in `android/app/build.gradle`:
- `versionCode` — integer, must increase every upload.
- `versionName` — user-facing string (e.g. "1.0.1").

## 3. Build the app bundle (AAB)
```
cd android && ./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`.
- R8 minification + resource shrinking are **on** for release
  (`enableProguardInReleaseBuilds = true`); keep rules for our native modules are
  in `android/app/proguard-rules.pro`. If a release build crashes with a
  `ClassNotFound`/`NoSuchMethod`, add a `-keep` rule there.
- Default ABIs: arm64-v8a, armeabi-v7a, x86, x86_64 (Play serves per-device).

## 4. Play Asset Delivery (SoundFont) — **[you]**
The dev SF2 is small (~0.5 MB), but a realistic grand-piano SF2 can be 50–200 MB.
To keep the base install lean:
- Move the large `.sf2` into an **install-time asset pack** (`com.android.asset-pack`
  module) and load it from the asset-pack path at startup instead of
  `assets/soundfonts/`. (`AudioEngineBridge.loadSoundFontFromAsset` already loads
  via `AssetManager`; an install-time pack is still visible to `AssetManager`, so
  the change is mostly the gradle module + asset location.)
- Alternatively ship per-quality SF2s as on-demand/fast-follow packs.
Document deferred until the real SF2 is chosen (size drives the decision).

## 5. Crash reporting — **[you] pick one**
- **Sentry** (`@sentry/react-native`): easiest — one DSN, JS + native crashes,
  source maps. `npx @sentry/wizard -i reactNative`.
- **Firebase Crashlytics** (`@react-native-firebase/app` + `/crashlytics`):
  needs a Firebase project + `google-services.json`.
Neither is added yet (both need an account/DSN). Wiring is ~30 min once chosen.

## 6. Play Console steps — **[you]**
1. Create the app in the Play Console (package `com.music` — consider a more
   unique applicationId before first upload; it's permanent).
2. Complete the store listing: title, short/full description, screenshots
   (use the landscape keyboard), feature graphic, icon, category, contact, privacy policy.
3. Data safety form (declare AdMob/crash-reporting data collection if added).
4. Content rating questionnaire.
5. Upload the AAB to a **closed/internal testing** track first.
6. Roll out to production as a **staged rollout** (e.g. 10% → 50% → 100%).

## 7. Pre-launch checklist
- [ ] Licensed `.sf2` shipped (or confirmed OK to distribute).
- [ ] `keystore.properties` set; Play App Signing enrolled.
- [ ] `versionCode`/`versionName` bumped.
- [ ] `bundleRelease` produces a signed AAB; release build launches & plays on a device.
- [ ] Crash reporting integrated and verified (test crash).
- [ ] AdMob real ad units (or ads intentionally off).
- [ ] Tested: 10-finger chords, fast glissando, instrument switch, record (both),
      song playback + speed, background/resume + incoming call, headphone/BT switch.
- [ ] Tested on a low-end device.
