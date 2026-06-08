# Realistic Piano — Android App Engineering Roadmap

**Stack:** React Native CLI (bare, no Expo) · New Architecture (Fabric + TurboModules + JSI) · Kotlin + C++ (NDK) · Oboe + FluidSynth

**Target:** A low-latency, multi-touch, multi-instrument piano with recording, playback, a song library, and ads — matching the provided UI.

---

## 1. The one constraint that shapes everything: latency

A piano feels "real" only if the gap between finger-down and sound-out is small. The human ear starts noticing lag around **20 ms**; above ~30 ms it feels like a cheap toy.

This single number kills the naive approach. You **cannot** do `onPress → setState → JS computes sound → asks native to play`. The React Native bridge is asynchronous and adds tens of milliseconds of jitter. So the architecture inverts the usual RN model:

> **JavaScript owns the look and the logic. A native C++ engine owns the sound. They talk through JSI (synchronous), and the audio hot-path never touches the JS event loop.**

Everything below follows from that principle.

---

## 2. Technology stack

| Layer | Choice | Why |
|---|---|---|
| App framework | React Native CLI (bare), latest stable | Native module freedom; New Architecture on by default in modern RN |
| Architecture mode | New Architecture (Fabric + TurboModules + **JSI**) | JSI lets JS call C++ *synchronously* with sub-millisecond overhead — essential for the audio hot-path |
| Language (UI/logic) | TypeScript | Type safety across a feature-heavy app |
| Language (audio) | C++17 (NDK) | The audio callback must be real-time-safe; no GC, no JNI in the hot loop |
| Audio I/O | **Oboe** (Google) | Lowest-latency Android audio; uses AAudio on modern devices, falls back to OpenSL ES |
| Synth engine | **FluidSynth** (SF2 SoundFonts) | Handles polyphony, ADSR, multiple instruments via bank/preset switching, MIDI playback — all in C++ |
| (Alt synth) | sfizz (SFZ) | Use only if you want sample-level control beyond SF2 |
| State management | Zustand | Lightweight, no boilerplate, plays well with the imperative audio layer |
| Animations / keys | Reanimated 3 + Gesture Handler | Runs gestures on the UI thread; keep keypress → sound off the JS thread |
| Drawing (optional) | @shopify/react-native-skia | For the mini-keyboard overview, glow effects, custom key rendering |
| Persistence | react-native-mmkv (settings) + react-native-fs (recordings/songs) | MMKV is fast key-value; FS for audio/MIDI files |
| Song format | Standard MIDI files (.mid) parsed natively | Tempo scaling = "Speed" slider; far smaller than audio |
| Ads | react-native-google-mobile-ads (AdMob) | The bottom banner slot in the UI |
| Permissions | react-native-permissions | Mic permission for "REC As Sound" |
| Navigation | react-native-navigation or react-navigation | Single-screen app, but you'll want modals (recordings list, settings) |

**Version policy:** pin to the current stable RN release at project start and check each native library's latest tag — RN, Reanimated, and Skia move fast, and version mismatches are the #1 source of build pain. Lock versions in `package.json` and don't float them.

---

## 3. System architecture

Three layers, talking in one direction for the hot-path:

```
┌──────────────────────────────────────────────────────────┐
│  REACT NATIVE (TypeScript)                                 │
│  • UI: keyboard, sliders, transport, song picker, ads      │
│  • Zustand store: instrument, volume, speed, notation,     │
│    recording state, selected song                          │
│  • Calls engine imperatively via JSI                       │
└───────────────┬────────────────────────────────────────────┘
                │  JSI (synchronous C++ calls)
                │  noteOn(pitch,vel) · noteOff(pitch) · setProgram()
                ▼
┌──────────────────────────────────────────────────────────┐
│  AUDIO ENGINE (C++ / NDK)  — the real-time core            │
│  • FluidSynth: polyphonic synthesis from .sf2 SoundFonts   │
│  • Oboe: pulls audio in a real-time callback               │
│  • Sequencer: schedules MIDI song events (with tempo scale)│
│  • Tap recorder: captures rendered PCM for "REC As Sound"  │
└──────────────────────────────────────────────────────────┘
```

**Two recording concepts (don't confuse them):**

- **"RECORD KEYS"** — records *events* (note, velocity, timestamp, duration) as a MIDI-like sequence. Tiny, editable, replayable through the same synth. This is what the small record/play buttons by the keyboard do.
- **"REC As Sound"** — taps the synth's rendered PCM output and writes a real audio file (WAV → encode to AAC/M4A). This is the big red REC button up top. It captures *exactly what you hear*, including instrument and volume.

---

## 4. Audio engine deep-dive (the part most tutorials get wrong)

**Signal flow:**
```
Oboe audio callback (real-time thread, ~5ms buffer)
   → asks FluidSynth to render N frames
   → FluidSynth mixes all active voices (the notes you're holding)
   → master gain (Volume slider) applied
   → written to Oboe buffer → speaker
   → (if recording-as-sound) same buffer copied to a ring buffer → writer thread → file
```

**Rules for the audio callback — break these and you get clicks/dropouts:**
- No memory allocation (`new`/`malloc`), no locks, no JNI calls, no logging inside the callback.
- Communicate with it via lock-free structures (e.g., a single-producer-single-consumer ring buffer for incoming note events, or FluidSynth's own thread-safe event API).
- Request the lowest stable buffer size Oboe will give you; expose a fallback if a device can't sustain it.

**Instruments (Piano / Flute / Organ / Guitar):** these are presets inside the SoundFont. Switching instrument = `fluid_synth_program_change()` to a different bank/preset. Ship one good multi-instrument `.sf2` in `assets/`, or one `.sf2` per instrument if you want higher quality per sound.

**SoundFont sourcing:** a quality piano SoundFont is the difference between "realistic" and "keyboard from 1998." Use a properly licensed, velocity-layered SF2 (e.g., a well-regarded free grand piano SF2) and verify its license allows commercial app distribution before shipping.

**Velocity:** if you keep a fixed touch area you'll get a fixed velocity. For realism, derive velocity from something — tap position on the key, or (if you add it later) accelerometer/pressure. At minimum, randomize velocity slightly so repeated notes don't sound machine-identical.

---

## 5. Keyboard input — the latency-critical path

This is where most RN piano apps fail. Two viable designs:

**Option A — RN keys, JSI hot-path (recommended start):**
Render keys with RN/Reanimated. Attach Gesture Handler. On touch-down, call the JSI `noteOn` **synchronously** from the gesture worklet/UI thread — *not* through a state update. State updates are only for the *visual* glow, which can lag a frame without anyone noticing. Sound fires immediately; pixels catch up.

**Option B — fully native key view:**
Implement the keyboard as a custom Android `View` (Kotlin) that handles `MotionEvent` and calls the C++ engine directly, embedded into RN as a Fabric native component. Lowest possible latency and best multi-touch/glissando handling, but more native work. Move here if Option A's feel isn't good enough.

**Multi-touch & glissando:** track every active pointer ID → note mapping. Sliding a finger across keys (glissando) = pointer moves over a new key → `noteOff(old)` + `noteOn(new)`. Chords = multiple simultaneous pointers, each its own note.

---

## 6. Feature breakdown (mapped to your UI)

| UI element | Feature | Implementation notes |
|---|---|---|
| **REC / As Sound** + timer | Record audio output | Tap synth PCM → ring buffer → WAV → encode to M4A; live timer from frame count |
| **LIST / Recordings** | Recordings library | List both audio files and key-sequences; play, rename, delete, share |
| **Piano / Flute / Organ / Guitar** | Instrument switch | FluidSynth program change; highlight active in store |
| **Speed** slider | Playback tempo | Scales the sequencer's tick→time conversion; 1.00 = original |
| **Volume** slider | Master gain | Applied as a gain multiplier in the callback (0–100%) |
| **Song dropdown (Happy Birthday)** | Song library | Bundle .mid files; parse and feed the native sequencer |
| **Play button (Music Control)** | Auto-play song | Start/stop sequencer; visually trigger keys as notes fire |
| **SHOW NOTES: C / Do** | Notation toggle | Map note→label: Western (C D E F G A B) vs solfège (Do Re Mi …); store preference |
| **Settings icon** | Advanced settings | Latency/buffer, transpose, sustain, key labels on/off |
| **RECORD KEYS** + rec/play | Event recording | Record note events with timestamps; replay through synth |
| **Mini-keyboard overview** | Scroll indicator | Skia strip showing which octaves are visible; tap to jump |
| **KEY SIZE − / fullscreen / +** | Zoom keyboard | Change key width (keys/screen); fullscreen hides chrome |
| **Note labels C3–F5** | Key labels | Driven by notation toggle; toggle visibility |
| **Ad banner / LEARN MORE** | AdMob banner | Banner ad unit; consider a paid "remove ads" tier later |

---

## 7. Proposed folder structure

```
PianoApp/
├── android/
│   └── app/src/main/
│       ├── cpp/                      # native audio engine
│       │   ├── AudioEngine.cpp/.h    # Oboe stream + callback
│       │   ├── SynthEngine.cpp/.h    # FluidSynth wrapper
│       │   ├── Sequencer.cpp/.h      # MIDI song playback + tempo
│       │   ├── PcmRecorder.cpp/.h    # tap output → file
│       │   ├── jsi/                  # JSI bindings (installAudioModule)
│       │   └── CMakeLists.txt
│       ├── java/com/pianoapp/
│       │   ├── audio/                # Kotlin glue, lifecycle, focus
│       │   └── keyboard/             # (Option B) native key view
│       └── assets/
│           ├── soundfonts/           # piano.sf2, etc.
│           └── songs/                # happy_birthday.mid, ...
├── ios/                              # later, if you go cross-platform
├── src/
│   ├── audio/
│   │   ├── AudioModule.ts            # typed JSI interface
│   │   └── useAudioEngine.ts
│   ├── components/
│   │   ├── keyboard/                 # Keyboard, Key, MiniMap, ZoomControls
│   │   ├── transport/                # PlayButton, RecordButton, Timer
│   │   ├── controls/                 # SpeedSlider, VolumeSlider, Sliders
│   │   ├── instruments/              # InstrumentSelector
│   │   ├── songs/                    # SongPicker, NotationToggle
│   │   └── ads/                      # AdBanner
│   ├── screens/
│   │   ├── PlayerScreen.tsx
│   │   └── RecordingsScreen.tsx
│   ├── store/                        # Zustand slices
│   │   ├── instrumentStore.ts
│   │   ├── settingsStore.ts          # volume, speed, notation, key size
│   │   └── recordingStore.ts
│   ├── domain/
│   │   ├── notes.ts                  # MIDI<->name<->solfège mapping
│   │   ├── midi.ts                   # .mid parsing
│   │   └── recording.ts             # event-recording model
│   ├── services/
│   │   ├── storage.ts                # MMKV + FS
│   │   └── permissions.ts
│   ├── theme/                        # colors, the neon/glow design tokens
│   └── App.tsx
├── package.json
└── tsconfig.json
```

---

## 8. Performance & quality checklist

- **Audio thread purity:** no allocation/locks/JNI/logging in the Oboe callback. Profile with Android's `systrace`/Perfetto.
- **Buffer size:** start small, fall back gracefully. Expose a "low latency vs stable" setting for old devices.
- **Audio focus & lifecycle:** pause/duck on calls and when backgrounded; release Oboe stream on stop; rebuild on resume.
- **Keyboard rendering:** memoize `Key` components; never re-render the whole keyboard on a single keypress. Drive glow with Reanimated shared values, not React state.
- **List virtualization:** use FlashList/virtualized lists for recordings and long song lists.
- **Glissando throughput:** debounce visual updates but never debounce `noteOn`/`noteOff` themselves.
- **Memory:** load the SoundFont once at startup; don't reload on instrument switch.
- **Cold start:** lazy-load the recordings/songs screens; initialize the audio engine early but off the first frame.
- **APK size:** SoundFonts are large — consider Play Asset Delivery or app bundles to keep the base install lean.
- **Battery/thermals:** stop the audio stream when truly idle (no held notes, not recording).

---

## 9. Phased delivery plan

**Phase 0 — Spike (prove latency is solvable)**
Bare RN CLI app + New Architecture. C++ Oboe stream playing a sine wave triggered by a single on-screen button via JSI. Measure round-trip latency on a real mid-range device. *Gate: if you can't get a satisfying tap-to-sound, fix it here before building anything else.*

**Phase 1 — Core instrument**
Integrate FluidSynth + a piano SoundFont. Full keyboard UI, multi-touch, note labels, volume slider. One playable, good-sounding piano.

**Phase 2 — Instruments & notation**
Piano/Flute/Organ/Guitar switching via program change. C/Do notation toggle. Key-size zoom + mini-keyboard overview + fullscreen.

**Phase 3 — Recording**
"RECORD KEYS" (event recording + replay). Then "REC As Sound" (PCM tap → M4A) with live timer. Recordings list: play/rename/delete/share.

**Phase 4 — Song library & auto-play**
Bundle MIDI songs, native sequencer, Play transport, Speed (tempo) control, visual key highlighting during playback.

**Phase 5 — Polish & monetize**
AdMob banner, settings screen, neon/glow visual polish, error/empty states, performance pass on low-end devices.

**Phase 6 — Release**
Play Store listing, app bundle + asset delivery for SoundFonts, crash reporting (Crashlytics/Sentry), staged rollout.

---

## 10. Top risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Latency too high on some devices | App feels fake | Phase 0 spike; Oboe fallback path; per-device buffer tuning |
| FluidSynth/NDK build complexity | Schedule slip | Build it first (Phase 0/1); use CMake prefab; pin NDK version |
| RN ↔ native version mismatches | Broken builds | Lock all versions; upgrade deliberately, not opportunistically |
| SoundFont licensing | Legal/store removal | Verify commercial-use license before shipping any .sf2 |
| Bridge used in hot-path by mistake | Latency regression | Code review rule: keypress path must be JSI-synchronous only |
| APK bloat from samples | Install drop-off | Play Asset Delivery; compress/trim SoundFonts |

---

## 11. Testing strategy

- **Latency measurement:** loopback or high-speed camera test of tap-to-sound; track it as a release metric.
- **Audio correctness:** unit-test note→MIDI→label mapping and MIDI parsing/tempo math in TS.
- **Device matrix:** test on at least one low-end, one mid, one flagship; old and new Android versions.
- **Stress:** 10-finger chords, fast glissandi, rapid instrument switching, record while playing a song.
- **Lifecycle:** incoming call, backgrounding, headphone unplug, Bluetooth audio switch mid-note.

---

### First three things to do tomorrow
1. `npx @react-native-community/cli init PianoApp` (bare), confirm New Architecture is on.
2. Add Oboe via CMake/prefab and get a JSI-triggered sine wave playing.
3. Measure tap-to-sound latency on a real phone. That number decides whether the rest of the plan is sound (literally).
