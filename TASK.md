# TASK.md — Build Tracker

> **Single source of truth for progress.** Claude Code: read this file at the start of every session to know where we left off. Update it at the end of every working session (and after completing any checklist item). Humans: skim "Resume Here" to see current state.

---

## How to use this file
- **Before working:** read `PIANO_APP_ROADMAP.md` (full plan), `CLAUDE.md` (rules), then this file.
- **While working:** tick boxes as items complete. Add notes inline.
- **After working:** update **Resume Here**, **Session Log**, and any **Open Questions / Blockers**.
- **Never** mark a phase "done" until its **Gate** is verified on a real device where applicable.
- One phase at a time. Do not start the next phase until the current phase's gate passes and the human confirms.

---

## Resume Here  ← (Claude Code starts by reading this)
- **Current phase:** Phase 6 — Release. **Repo prep done & release build verified on emulator; the remaining gate items are account/console work (need your credentials + the licensed `.sf2`). See RELEASE.md.**
- **Last completed:** Release readiness — env-based release signing (`keystore.properties`, gitignored; debug fallback), R8 minify + resource shrink ON with keep rules for `com.music.audio.**` + JNI, and **a verified R8-minified release build that installs and launches standalone (bundled Hermes JS) with the full UI, no stripping crashes.** Wrote **RELEASE.md** (signing, AAB, PAD plan, crash-reporting options, Play Console steps, pre-launch checklist). `tsc` clean, `jest` 1/1.
- **Next action (HUMAN — Phase 6):** Follow **RELEASE.md**: (1) choose/ship a commercially-licensed `.sf2`; (2) generate an upload keystore + `keystore.properties`; (3) pick a crash reporter (Sentry/Crashlytics) — I can wire it in ~30 min once chosen; (4) decide a more-unique `applicationId` than `com.music` before first upload; (5) create the Play Console listing + internal-test track → staged rollout. Tell me which of (3)/(4) you want me to do in-repo.
- **Active blocker for shipping:** the licensed `.sf2`, a Play Console account, and a crash-reporting choice. Code is release-buildable today.
- **Gates:** Phase 0/1 passed (human, 2026-06-06). Phase 2–5 functionally verified on emulator; human said continue (real-device audio confirmation still pending across phases).
- **Open:** (1) shipping `.sf2` + license; (2) real-device audio/feel confirmation (Phases 1–5); (3) crash reporting; (4) real AdMob SDK (placeholder now); (5) low-end perf pass; (6) PAD once SF2 chosen; (7) optional real `.mid` import; (8) live speed change mid-song.

---

## Decisions Log
> Append architectural decisions here so context survives across sessions. Don't silently change these — record the reason.

| Date | Decision | Reason |
|---|---|---|
| — | RN CLI (bare), New Architecture (JSI) | Need synchronous native calls for audio hot-path |
| — | Oboe + FluidSynth in C++ | Lowest-latency audio + SF2 polyphony/instruments |
| — | Keypress → sound path must be JSI-synchronous, never via JS state/bridge | Latency |
| — | Instruments = SoundFont program changes, not separate engines | Simplicity |
| — | Two recorders: "RECORD KEYS" (events) vs "REC As Sound" (PCM→m4a) | Different features |
| 2026-06-06 | JSI surface = a **pure C++ TurboModule** (`NativeAudioEngine`), registered via `cxxModuleProvider` in `jni/OnLoad.cpp`; spec in `src/specs/NativeAudioEngine.ts`, app-level codegen `AppSpecs` (`type: modules`) | C++ TurboModule method calls are synchronous JSI straight into C++ — zero JNI, zero async bridge — exactly the latency-critical path the roadmap mandates |
| 2026-06-06 | Native C++ engine lives in `android/app/src/main/cpp/`; RN's required CMake+OnLoad override lives in `android/app/src/main/jni/` (custom `CMakeLists.txt` adds Oboe + `../cpp` sources) | RN's gradle plugin only picks up an app-level CMake at `src/main/jni/CMakeLists.txt`; keeping engine code in `cpp/` honors the roadmap folder structure |
| 2026-06-06 | Oboe via prefab, pinned `com.google.oboe:oboe:1.10.0` (latest on Google Maven, 2025-09) | Lowest-latency Android audio; prefab is already enabled by the RN gradle plugin |
| 2026-06-06 | Tone on/off crosses JS→audio thread via a single `std::atomic<bool>`; amplitude is ramped in the callback | Keeps the audio callback allocation/lock/JNI/log-free (CLAUDE.md §2) and click-free |
| 2026-06-06 | Android package stays `com.music` (roadmap said `com.pianoapp`) | Project was already scaffolded as `com.music`; renaming buys nothing |
| 2026-06-06 | **Phase 1 synth = TinySoundFont (TSF)** instead of the roadmap-pinned FluidSynth (confirmed by user). Wrapped behind `SynthEngine` so it's swappable. | FluidSynth needs glib cross-compiled for the NDK (Meson, no official Android Maven) — large build risk before any sound. TSF is header-only (MIT), zero deps, audio-callback-safe, does SF2 polyphony/velocity/program-change. FluidSynth remains a possible later upgrade if reverb/chorus/full-MIDI are needed. |
| 2026-06-06 | Note events cross JS→audio thread via a lock-free SPSC ring buffer; `tsf` is built off-thread and published via an atomic pointer; voices pre-reserved (`tsf_set_max_voices`) and channel 0 initialised at load | Keeps the Oboe callback allocation/lock/JNI/log-free (CLAUDE.md §2); TSF is only ever mutated on the audio thread (drained from the queue) |
| 2026-06-06 | `AudioEngine` is a process singleton; driven by both the C++ TurboModule (JS notes) and the JNI startup bridge (Kotlin loads SF2) | Two entry points need the same engine instance; load-once-at-startup per roadmap §8 |
| 2026-06-06 | SoundFont loaded from APK assets via AAssetManager in a JNI bridge called from `MainApplication.onCreate` (after `loadReactNative`); dev SF2 = `florestan-subset.sf2` (TSF example) | Avoids a file-copy step; loads once before first frame. Shipping SF2 + license still an open question. |
| 2026-06-06 | Keyboard input = single transparent responder overlay reconciled against the live touch list (not per-key Pressables); notes ref-counted | One uniform path gives multi-touch chords + glissando + clean per-finger release; per-key Pressables can't do glissando. (Reanimated/GestureHandler worklet path = possible Phase 2/Option-B upgrade.) |
| 2026-06-06 | Volume slider built with PanResponder (no `@react-native-community/slider`) | Avoids adding another native dependency/build for a trivial control |
| 2026-06-06 | App locked to `sensorLandscape` | The reference UI is landscape; a piano wants the width |
| 2026-06-06 | **Phase 2.** Instruments map to explicit bank-0 preset numbers of the dev SF2 (Piano 2, Flute/PanFlute 75, Organ 19, Guitar/Nylon 24), not GM numbers | florestan-subset.sf2 isn't GM-numbered (verified by parsing its `phdr`); when we ship a GM SoundFont, switch `domain/instruments.ts` to GM programs |
| 2026-06-06 | Keyboard zoom = a **windowed slice** of a fixed full range (C2–C7) sized by KEY SIZE +/-, moved by the mini-keyboard — the main keyboard never horizontally scrolls | A ScrollView would fight glissando/multi-touch; windowing keeps hit-testing trivial and input solid |
| 2026-06-06 | Notation-toggle **persistence deferred** (settings are in-memory for now) | Persisting needs a storage lib (roadmap pins MMKV, which on New-Arch pulls in Nitro). Deferred to the Settings/Phase-5 work to avoid build risk mid-Phase-2; flagged at the Phase 2 gate |
| 2026-06-07 | **Persistence = AsyncStorage** (not MMKV), via zustand `persist` (user-confirmed) | MMKV on New-Arch pulls in Nitro modules → more build risk on this RN 0.85 setup. AsyncStorage is one well-supported dep. Persists settings/instrument/keyboard/recordings; engine state re-applied on rehydrate. (Deviates from roadmap's MMKV pin — recorded here.) |
| 2026-06-07 | **REC As Sound = C++ PCM→WAV + Kotlin WAV→.m4a** (user-confirmed: store as .m4a). C++ `PcmRecorder` (lock-free SPSC ring, audio-thread producer + writer thread) writes 16-bit WAV; Kotlin `RecorderModule` encodes to AAC/.m4a via MediaCodec/MediaMuxer | Keeps the Oboe callback pure (just feeds a ring); MediaCodec in Kotlin is far simpler/safer than NDK AMediaCodec. |
| 2026-06-07 | Recorder control = a **legacy Kotlin native module** (`RecorderModule` via `RecorderPackage`), not a codegen TurboModule | Needs async (Promise) file/encode/share ops + MediaPlayer; works through the New-Arch interop layer with much less wiring than an app-level Kotlin TurboModule. Note recording is fire-and-forget (not latency-critical), so async is fine — unlike the keypress path which stays C++ JSI. |
| 2026-06-07 | Share via Android `FileProvider` + `ACTION_SEND` intent (no extra JS lib) | Avoids react-native-share; FileProvider authority `${applicationId}.fileprovider`, paths in res/xml/file_paths.xml |
| 2026-06-07 | **Phase 4.** Songs authored as **TS note data** + a **JS sequencer** (timer-scheduled), instead of bundled `.mid` files + a native sequencer | Auto-play isn't latency-critical (no tap response), so JS scheduling is accurate enough and avoids binary-asset loading + native scheduler work. A real `.mid` parser (`domain/midi.ts`) + native sequencer can replace `songPlayer`/`songs.ts` later without touching the UI. |
| 2026-06-07 | Speed (tempo) = divide each note's on/off time by the speed multiplier at play start; live mid-song speed change not yet applied | Simple + correct for the gate; live re-scheduling on speed change is a later refinement |
| 2026-06-07 | Playback key-highlight via a `playbackStore.active` set merged into the keyboard's glow (separate from touch glow) | Keeps the touch hot-path untouched; song highlight is just another source of "lit" keys |
| 2026-06-07 | **Phase 5.** Ads = **placeholder slot** (`AdBanner`), not the real AdMob SDK yet (user-confirmed) | Avoids adding react-native-google-mobile-ads + app-id config now; slot is structured for a drop-in later |
| 2026-06-07 | Transpose applied in the keyboard with a **visual-key vs sounding-pitch split** (glow uses visual key, engine uses key+transpose; pointer stores both) | Chords + transpose can't cut each other off, and the pressed key still lights even when transposed |
| 2026-06-07 | Audio lifecycle = stop/close the Oboe stream on `onPause`, rebuild on `onResume`, + AudioManager focus listener (pause on loss, resume on gain) | Frees audio + battery when backgrounded; survives calls/interruptions. SoundFont stays loaded (lives in the engine singleton, separate from the stream). |
| 2026-06-07 | **Phase 6.** Release signing reads gitignored `android/keystore.properties` (falls back to debug keystore if absent); secrets never committed | Standard secure pattern; keeps local/CI release builds working without exposing the upload key |
| 2026-06-07 | R8 minify + resource shrink **on** for release, with keep rules for `com.music.audio.**` (@ReactMethod + JNI native methods) and Oboe | Smaller bundle; keep rules prevent R8 from stripping the reflectively-invoked RecorderModule + JNI entry points |
| 2026-06-07 | Play Asset Delivery for the SoundFont **documented, not implemented** | The dev SF2 is tiny; PAD only matters once a large licensed grand-piano SF2 is chosen — its size drives install-time-pack vs on-demand |

---

## Phase 0 — Spike: prove latency is solvable
**Gate:** A JSI-triggered tone plays on tap with satisfying, measured low latency on a real mid-range device.
- [x] Confirm fresh RN CLI project builds and runs on device (`npx react-native run-android`) — _RN 0.85.3; built + installed + launched on x86_64 emulator, spike UI renders, no crash_
- [x] Confirm New Architecture is enabled — _`newArchEnabled=true`, Hermes on, in `android/gradle.properties`_
- [x] Add Oboe via CMake/prefab; project compiles with NDK — _`oboe:1.10.0` prefab + custom `jni/CMakeLists.txt` (see Session Log for build result)_
- [x] C++ AudioEngine: open Oboe output stream, render a sine wave — _`cpp/AudioEngine.{h,cpp}`, LowLatency/Exclusive, lock-free, click-free ramp_
- [x] JSI binding: `startTone()` / `stopTone()` callable from JS — _C++ TurboModule `cpp/NativeAudioEngine.{h,cpp}`, spec `src/specs/NativeAudioEngine.ts`_
- [x] One on-screen button triggers tone via JSI (NOT via setState round-trip) — _`App.tsx`: `onPressIn` calls `NativeAudioEngine.startTone()` directly_
- [x] Measure tap-to-sound latency on a real device; record number in "Resume Here" — **confirmed acceptable (< ~30 ms) by human on 2026-06-06**
- [x] **Gate review with human** before Phase 1 — **PASSED 2026-06-06; cleared to start Phase 1**

## Phase 1 — Core instrument (piano)
**Gate:** A single, good-sounding, multi-touch piano you'd actually want to play.
- [x] ~~Integrate FluidSynth~~ → **Integrated TinySoundFont (TSF)** into the C++ engine (`SynthEngine`, swappable) — _see Decisions Log_
- [x] Load a piano `.sf2` from assets at startup — _dev SF2 `florestan-subset.sf2` via AAssetManager+JNI at `MainApplication.onCreate`; **shipping SF2 + license still open**_
- [x] JSI: `noteOn(pitch, velocity)` / `noteOff(pitch)` — _C++ TurboModule → lock-free queue → audio thread_
- [x] Keyboard UI (white/black keys) matching `ref/piano_ui.png` — _landscape, neon theme, C3–C6_
- [x] Multi-touch: each pointer → its own note; chords work — _responder reconcile + ref-counted notes (verify true 10-finger on a physical device)_
- [x] Glissando: sliding across keys retriggers notes — _verified on emulator (swipe highlights move key-to-key, no crash)_
- [x] Note labels on keys — _C3–C6 (superset of C3–F5); C notes accented pink like the ref_
- [x] Volume slider → master gain — _custom PanResponder slider → `setMasterGain`, applied in render_
- [x] Verify no clicks/dropouts under fast play — **confirmed acceptable by human on 2026-06-06**
- [x] **Gate review** — **PASSED 2026-06-06; cleared to start Phase 2**

## Phase 2 — Instruments & notation
**Gate:** Switch instruments instantly; toggle note naming; resize keyboard.
- [x] Flute / Organ / Guitar via program change — _TSF `setProgram` to dev-SF2 presets (Piano 2 / Flute 75 / Organ 19 / Guitar 24); verified Organ switch with active audio_
- [x] Instrument selector UI + active state in store — _`InstrumentSelector` + `instrumentStore`_
- [~] C / Do notation toggle (Western ↔ solfège) — _works (verified relabel to Do Re Mi); **persistence deferred** (in-memory; needs MMKV/storage — see Decisions Log)_
- [x] Key-size zoom (− / +) and keys-per-screen — _`keyboardStore` windowing; verified fewer/bigger keys_
- [x] Fullscreen mode (hide chrome) — _hides top bar + instrument row; **hides status bar** so exit stays tappable; verified enter/exit_
- [x] Mini-keyboard overview strip + tap-to-jump — _`MiniKeyboard` with window highlight + PanResponder; verified window jump to A4–C7_
- [~] **Gate review** — functionally verified on emulator; **audio not heard on emulator (host/emulator routing issue, engine confirmed producing voices)**. Human directed "continue" → proceeding to Phase 3 with Phase 2 audio still to be confirmed on a real device.

## Phase 3 — Recording
**Gate:** Both recorders work and recordings are manageable.
- [x] "RECORD KEYS": capture note events (note, velocity, timestamp) — _`recordingStore` + performer layer; verified 4 taps → 8 events @ 0:04_
- [x] Replay key-event recordings through the synth — _`recordingPlayer` (timer scheduler); verified active audio throughout replay_
- [x] "REC As Sound": tap synth PCM → ring buffer → WAV → encode m4a — _`PcmRecorder` (C++ lock-free ring + writer thread → WAV) + `RecorderModule` (Kotlin MediaCodec/MediaMuxer → **.m4a**); verified a 0:05 / 75 KB .m4a produced + plays back_
- [x] Live recording timer — _both recorders show mm:ss while recording; REC-As-Sound duration from native frame count_
- [x] Mic permission flow — **N/A** (REC As Sound taps the synth output, not the mic) — no permission needed
- [x] Recordings list: play / rename / delete / share — _unified modal: audio (.m4a) play/rename/delete/share (FileProvider) + key takes play/rename/delete_
- [~] **Gate review** — verified on emulator (.m4a produced + plays, persistence survives restart). Real-device audio/Share still to confirm. Human directed "continue" → proceeding to Phase 4.

> **Phase 3 complete & verified on emulator** (persistence via AsyncStorage; settings/instrument/notation survive restart; audio files persist on disk). Remaining: real-device confirmation of audio + share at the gate.

## Phase 4 — Song library & auto-play
**Gate:** Bundled songs play back with working speed control and key highlighting.
- [x] Bundle songs (Happy Birthday, Twinkle Twinkle, Ode to Joy) — _authored as TS note data; see deviation in Decisions Log_
- [x] ~~MIDI parsing (TS) + native sequencer~~ → **JS sequencer over TS song data** (`audio/songPlayer.ts`) — _deviation recorded; auto-play isn't latency-critical_
- [x] Play/stop transport (Music Control) — _`SongControl` + `playbackStore`; verified ■/▶ + active audio_
- [x] Speed slider = tempo scaling — _enabled; `settingsStore.speed` (persisted) divides event timestamps in the sequencer_
- [x] Highlight keys visually as notes fire during playback — _`playbackStore.active` merged into keyboard glow; verified Si4 lit during Happy Birthday_
- [x] Song picker dropdown — _verified: Happy Birthday / Twinkle / Ode to Joy_
- [ ] **Gate review** — pending human real-device play-test (hear playback + speed)

## Phase 5 — Polish & monetize
**Gate:** Ships-quality look, behaves well on low-end devices.
- [~] AdMob banner (bottom slot) — **placeholder slot** built (`AdBanner`, matches mock) per user choice; real AdMob SDK (test IDs) deferred
- [x] Settings screen (transpose, sustain, labels) — _`SettingsModal` (gear); labels toggle verified hiding labels; sustain → engine; transpose ±12; buffer/latency shown as info_
- [x] Neon/glow visual polish to match the UI mock — _active-key glow (accent border + elevation); on-theme throughout_
- [x] Empty/error/loading states — _recordings empty states; guarded native calls; module-absent fallbacks_
- [ ] Performance pass on a low-end device — **deferred** (no low-end device here); keys/components memoized, no full-keyboard re-render per note
- [x] Audio focus / lifecycle — _onPause→stop Oboe / onResume→start (verified: clean `AAudioStream_close` on background, rebuild + audio on resume, no crash); AudioManager focus (pause on loss/transient, resume on gain)_
- [ ] **Gate review** — pending human real-device check (audio focus on a real call, headphone/BT switch, low-end perf)

## Phase 6 — Release
**Gate:** On the Play Store. (Inherently human/console-driven; repo prep done here.)
- [x] App bundle + release build — _`bundleRelease`/`installRelease` build wired; release signing via gitignored `keystore.properties` (debug fallback); R8 + resource-shrink ON with keep rules. **Verified: R8-minified release APK builds, installs, and launches standalone (bundled Hermes JS, no Metro) with the full UI and no stripping crashes.** PAD documented (not implemented — depends on real SF2 size)._
- [ ] Crash reporting (Crashlytics/Sentry) — **[you] pick one** (not added; needs account/DSN — see RELEASE.md §5)
- [ ] Store listing assets — **[you]** (RELEASE.md §6)
- [ ] Staged rollout — **[you]** (RELEASE.md §6)
- [ ] **Gate review** — needs your Play Console account + the licensed `.sf2`

> **Phase 6 repo prep done; the rest is account/console work.** See **RELEASE.md** for the
> full checklist. Top blockers: a commercially-licensed `.sf2`, a crash-reporting choice,
> AdMob account, and a (recommended) more-unique `applicationId` than `com.music`.

---

## Open Questions / Blockers
> Log anything that needs a human decision or is blocking progress.
- [ ] Which piano `.sf2` will we ship? (must confirm commercial license) — **unresolved**
- [ ] Single multi-instrument SF2 vs one SF2 per instrument? — decide by Phase 2
- [ ] Min Android API level / device matrix? — decide before Phase 0 gate

---

## Session Log
> One short entry per working session: date · what changed · what's next.
- **2026-06-06 · Session 1 (Phase 0 spike).**
  - Wrote `CLAUDE.md` (permanent rules: latency, callback purity, architecture, two recorders, folder structure, workflow).
  - Implemented the latency spike, JS→C++ via synchronous JSI:
    - `src/specs/NativeAudioEngine.ts` (TurboModule spec) + `codegenConfig` in `package.json` (`AppSpecs`, `type: modules`).
    - `android/app/src/main/cpp/AudioEngine.{h,cpp}` — Oboe LowLatency/Exclusive stream, 440 Hz sine, lock-free atomic control, click-free amplitude ramp, device-disconnect recovery.
    - `android/app/src/main/cpp/NativeAudioEngine.{h,cpp}` — pure C++ TurboModule (`startTone`/`stopTone`).
    - `android/app/src/main/jni/CMakeLists.txt` + `OnLoad.cpp` — override RN default to link Oboe + `../cpp`, register the C++ TM via `cxxModuleProvider`.
    - `android/app/build.gradle` — `oboe:1.10.0` dep + `externalNativeBuild` cmake path.
    - `App.tsx` — spike UI: hold-to-sound pad calling the TurboModule directly (no setState in the sound path).
    - `jest.config.js` + `jest.setup.js` — mock the native module so JS tests run.
  - Verified: `tsc --noEmit` clean; `jest` passes (1/1); `assembleDebug` (arm64) **BUILD SUCCESSFUL**; `installDebug` (x86_64) onto emulator-5554 **BUILD SUCCESSFUL**.
  - On-emulator smoke test: app launches, spike UI renders, `NativeAudioEngine` TurboModule resolves and is called from JS (no "module could not be found" redbox), and `com.music` registers an output stream with AudioFlinger (Oboe stream opened). Emulator shows "No FastMixer/FastTrack" — no low-latency path on emulators, hence latency must be measured on real hardware.
  - **Next:** HUMAN runs on a real mid-range device and measures tap-to-sound latency (Phase 0 Gate). Do NOT start Phase 1 until the Gate passes and is confirmed.
- **2026-06-06 · Session 2 (Phase 0 gate + Phase 1).**
  - Phase 0 Gate confirmed by human (latency acceptable). Cleared to Phase 1.
  - Chose **TinySoundFont over FluidSynth** (user-confirmed) — see Decisions Log.
  - Native: vendored `tsf.h` (MIT) under `cpp/third_party/`; new `cpp/SynthEngine.{h,cpp}` (TSF + lock-free SPSC event queue, atomic-published synth, pre-reserved voices, master-gain scaling); refactored `cpp/AudioEngine.{h,cpp}` to a singleton rendering via SynthEngine; `cpp/AudioEngineJni.cpp` (load SF2 from AAssetManager); `java/com/music/audio/AudioEngineBridge.kt` + `MainApplication.onCreate` hook; TurboModule now `noteOn/noteOff/setMasterGain`; CMake links `oboe` + `android`; manifest locked `sensorLandscape`.
  - Assets: bundled dev `assets/soundfonts/florestan-subset.sf2`.
  - JS: `domain/notes.ts`, `store/settingsStore.ts` (zustand), `audio/audio.ts`, `theme/colors.ts`, `components/keyboard/Keyboard.tsx` (multi-touch + glissando via responder reconcile, ref-counted notes), `components/controls/Slider.tsx` (PanResponder), `screens/PlayerScreen.tsx`, rewired `App.tsx`. Added `zustand`.
  - Verified on emulator-5554: built/installed/launched, keyboard matches ref (landscape), keypress glows correct key + active AudioFlinger track, glissando works, no crash, SF2 loads. `tsc` clean, `jest` 1/1.
  - **Next:** HUMAN play-tests on a real device for sound/feel + multi-finger + dropouts (Phase 1 Gate). Do NOT start Phase 2 until confirmed.
- **2026-06-06 · Session 3 (Phase 1 gate + Phase 2).**
  - Phase 1 Gate confirmed by human (plays well). Cleared to Phase 2.
  - Parsed dev SF2 `phdr` → instruments mapped to bank-0 presets (Piano 2 / Pan Flute 75 / Church Organ 19 / Nylon Guitar 24).
  - Native: added `setProgram` to the spec + C++ TurboModule (SynthEngine/AudioEngine already supported it); rebuilt + reinstalled.
  - JS: `domain/instruments.ts`, `store/instrumentStore.ts`, `store/keyboardStore.ts` (windowing/zoom/fullscreen); components `InstrumentSelector`, `NotationToggle` (SHOW NOTES C/Do), `ZoomControls` (KEY SIZE −/⛶/+), `MiniKeyboard` (overview + tap-to-jump); `Keyboard` now renders a windowed slice; `PlayerScreen` recomposed to match the ref (instrument row, notation toggle, nav strip) with fullscreen hiding chrome + status bar.
  - Verified on emulator-5554: instrument switch (Organ) with active audio; C↔Do relabel; zoom; fullscreen enter/exit (fixed status-bar overlap); mini-keyboard window jump. `tsc` clean, `jest` 1/1.
  - Deferred: settings persistence (in-memory for now). Flagged at gate.
  - **Next:** HUMAN play-tests Phase 2 on device. Do NOT start Phase 3 until confirmed.
- **2026-06-07 · Session 4 (Phase 3 — RECORD KEYS).**
  - User directed "continue" past the Phase 2 gate (audio unverified on emulator). Started Phase 3.
  - Built the event recorder (pure JS, no new deps): `domain/recording.ts`, `store/recordingStore.ts`, `audio/performer.ts` (keyboard routes through it so recording is transparent), `audio/recordingPlayer.ts` (timer-scheduled replay through the synth), `components/transport/RecordKeysControls.tsx` (REC/Play + live timer), `components/recordings/RecordingsModal.tsx` (play/rename/delete), wired into `PlayerScreen` (☰ LIST + nav-strip controls).
  - Verified on emulator: record→8 events, replay keeps audio active, list shows metadata, rename field opens. `tsc`/`jest` green.
  - **Deferred (need decisions):** REC-As-Sound native pipeline, persistence, share. Phase 3 is partially complete.
- **2026-06-07 · Session 5 (Phase 3 — persistence + REC As Sound).**
  - User chose AsyncStorage + "build REC As Sound now" + store as **.m4a**.
  - Persistence: added `@react-native-async-storage/async-storage`; wrapped settings/instrument/keyboard/recordings stores in zustand `persist`; engine re-applies gain/program on rehydrate; jest mock added. Verified Organ+Do survive a restart.
  - REC As Sound: `cpp/PcmRecorder.{h,cpp}` (lock-free SPSC ring + writer thread → 16-bit WAV), wired into `AudioEngine` (feeds ring from the pure callback) + JNI in `AudioEngineBridge`; Kotlin `RecorderModule`/`RecorderPackage` (legacy module, interop) encodes WAV→**.m4a** (MediaCodec/MediaMuxer), lists/plays(MediaPlayer)/renames/deletes/shares (FileProvider + res/xml/file_paths.xml, manifest provider). JS: `audio/soundRecorder.ts`, `store/soundRecorderStore.ts`, `components/transport/SoundRecordButton.tsx`, unified `RecordingsModal`.
  - Verified on emulator: recorded a 0:05 / 75 KB .m4a (MediaCodec AAC), shows in list, plays back (2 active tracks); persistence survives restart. `tsc`/`jest` green.
  - **Next:** HUMAN play-tests Phase 3 on a real device (hear .m4a + Share). Do NOT start Phase 4 until confirmed.
- **2026-06-07 · Session 6 (Phase 4 — songs & auto-play).**
  - User directed "continue" past Phase 3 gate. Built song library (pure JS, no native changes).
  - `domain/song.ts` (+ `songFromMelody`), `domain/songs.ts` (Happy Birthday/Twinkle/Ode to Joy), `audio/songPlayer.ts` (timer sequencer w/ tempo scale + highlight), `store/playbackStore.ts`, `speed` added to `settingsStore` (persisted), `components/songs/SongControl.tsx` (picker + transport); Keyboard merges `playbackStore.active` into glow; Speed slider wired.
  - Verified on emulator: Happy Birthday plays with keys highlighting (Si4 lit) + active audio; transport ■/▶; picker switches songs. `tsc`/`jest` green.
  - Deviation: TS song data + JS sequencer instead of `.mid` + native sequencer (recorded in Decisions Log).
  - **Next:** HUMAN play-tests Phase 4 on a real device. Do NOT start Phase 5 until confirmed.
- **2026-06-07 · Session 7 (Phase 5 — polish & monetize).**
  - User directed "continue"; chose ad **placeholder slot** (not real AdMob yet).
  - Native: `setSustain` through spec/TM/SynthEngine (`tsf_channel_set_sustain`); audio lifecycle — `AudioEngineBridge.pause/resume` → JNI stop/start, `AudioLifecycle.kt` (AudioManager focus) hooked in `MainActivity` onPause/onResume.
  - JS: settingsStore gains showLabels/transpose/sustain (persisted); `SettingsModal` + gear; Keyboard transpose (visual/sounding split) + labels toggle; `AdBanner` placeholder; active-key neon glow.
  - Verified on emulator: Settings opens; labels toggle hides labels; background closes Oboe cleanly + resume rebuilds with working audio (no crash); ad banner + gear render per mock. `tsc`/`jest` green.
  - Deferred: real AdMob SDK, low-end perf pass.
  - **Next:** HUMAN checks Phase 5 on a real device (Settings, audio focus on a call, headphone/BT, low-end feel). Do NOT start Phase 6 until confirmed.
- **2026-06-07 · Session 8 (Phase 6 — release prep).**
  - User directed "continue". Did the in-repo release prep (the rest of Phase 6 is Play Console/account work).
  - `app/build.gradle`: env-based release signing from gitignored `keystore.properties` (debug fallback); R8 `minifyEnabled` + `shrinkResources` ON for release. `proguard-rules.pro`: keep rules for `com.music.audio.**` (@ReactMethod + native) + Oboe. Added `keystore.properties.template`, gitignored `keystore.properties`.
  - Wrote **RELEASE.md** (signing, versioning, AAB, Play Asset Delivery plan, crash-reporting options, Play Console steps, pre-launch checklist).
  - Verified on emulator: `installRelease` (R8-minified, Hermes-bundled, debug-signed fallback) **BUILD SUCCESSFUL**; release app launches standalone and renders the full UI with no R8/ClassNotFound crashes; persistence intact across reinstall. `tsc`/`jest` green.
  - Handoff: licensed `.sf2`, real keystore, crash reporter, unique applicationId, Play Console listing/rollout (all in RELEASE.md).
  - **Audio output note:** User reported "no sound" on the **emulator**. Added temp native diagnostics → confirmed the engine works: `loadFromMemory ok: presets=17, sampleRate=48000`, and key presses start real voices (`activeVoices=1,2`) into `AUDIO_DEVICE_OUT_SPEAKER`. So it's an **emulator audio-routing/host-mixer issue, not a code bug** (fix: Windows Volume Mixer for `qemu-system`, cold-boot AVD, host output device; or test on a physical device). Diagnostics removed after (audio-thread log would violate callback purity); a benign startup `PianoSynth` load log remains.
