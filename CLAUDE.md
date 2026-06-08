# CLAUDE.md — Permanent Rules for the Realistic Piano App

> These are the **non-negotiable rules** distilled from `PIANO_APP_ROADMAP.md`.
> Every session must follow them. If a rule here ever conflicts with a quick hack,
> the rule wins. Read this file + `TASK.md` at the start of **every** session.

---

## 0. Session workflow (how we work)

- **Start every session** by reading, in order: `PIANO_APP_ROADMAP.md` (plan) → this file
  (rules) → `TASK.md` (where we left off). Then look at `ref/piano_ui.png` for any UI work.
- **Work ONE phase at a time.** Phases are defined in `TASK.md` / roadmap §9.
  Do not start the next phase until the current phase's **Gate** passes and the human confirms.
- **Never skip Phase 0** (the latency spike). It is the foundation; everything depends on it.
- **Stop at each Gate** and ask the human to verify before continuing.
- As you complete checklist items in `TASK.md`, tick them off and keep **Resume Here**,
  **Session Log**, and **Decisions Log** accurate. Leave `TASK.md` truthful at session end.
- **Record every architectural decision** in the Decisions Log in `TASK.md`, with the reason.

---

## 1. THE LATENCY CONSTRAINT (the rule that shapes everything)

- **Tap-to-sound must be under ~30 ms** (ideally < 20 ms). Above this the piano feels fake.
- The **keypress → sound path MUST go through JSI synchronously.**
- **NEVER** trigger audio via React state (`setState`/Zustand) or the async RN bridge.
  No `onPress → setState → compute → ask native to play`. That path is async and adds tens of ms.
- The correct path: gesture/touch-down → **synchronous JSI call into C++** (`noteOn`) →
  C++ engine flips a lock-free flag/queues an event → the already-running Oboe callback renders it.
- **Visual glow may lag a frame; sound may not.** Drive key glow with Reanimated shared
  values, never gate the sound on a React render.
- Any code review must reject a keypress path that touches the bridge or React state. (roadmap §1, §5, §10)

## 2. AUDIO CALLBACK PURITY (break this → clicks/dropouts)

Inside the Oboe audio callback (the real-time thread) there must be:
- **No memory allocation** (`new`/`malloc`/STL container growth).
- **No locks** / mutexes / blocking.
- **No JNI calls.**
- **No logging.**
- Communicate with the callback only via **lock-free structures** (e.g. SPSC ring buffer,
  atomics, or FluidSynth's thread-safe event API).
- Request the lowest stable buffer size Oboe will give; provide a fallback for weak devices. (roadmap §4, §8)

## 3. ARCHITECTURE (one direction for the hot-path)

- **JavaScript (TypeScript) owns the look and the logic** — UI, Zustand state, song/MIDI logic.
- **C++ (NDK) owns the sound** — Oboe (real-time I/O) + FluidSynth (synthesis) + sequencer + PCM recorder.
- **They talk via JSI** (synchronous C++ calls): `noteOn(pitch,vel)`, `noteOff(pitch)`,
  `setProgram(...)`, transport, etc. The audio hot-path never touches the JS event loop.
- Instruments (Piano/Flute/Organ/Guitar) are **SoundFont program changes**
  (`fluid_synth_program_change`), **not** separate engines. Load the SoundFont once at startup.
- Stack is pinned: **RN CLI bare + New Architecture (Fabric + TurboModules + JSI), Hermes,
  TypeScript, C++17, Oboe, FluidSynth.** Lock versions; do not float them. Upgrade deliberately. (roadmap §2, §3, §10)

## 4. THE TWO RECORDERS (never conflate them)

- **"RECORD KEYS"** = records **events** (note, velocity, timestamp, duration) as a MIDI-like
  sequence. Tiny, editable, replayed through the same synth. (The small rec/play buttons by the keyboard.)
- **"REC As Sound"** = taps the synth's **rendered PCM** output → ring buffer → WAV → encode to
  AAC/M4A. Captures exactly what you hear (instrument + volume). (The big red REC button up top.) (roadmap §3, §6)

## 5. FOLDER STRUCTURE (target layout from the roadmap)

> Actual Android package is `com.music` (not `com.pianoapp`). Native C++ engine lives under
> `android/app/src/main/cpp/`; the RN-required CMake/OnLoad override lives in
> `android/app/src/main/jni/` (see Decisions Log in TASK.md).

```
android/app/src/main/
  cpp/                      # native audio engine (C++17)
    AudioEngine.{cpp,h}     # Oboe stream + real-time callback
    SynthEngine.{cpp,h}     # FluidSynth wrapper            (Phase 1+)
    Sequencer.{cpp,h}       # MIDI playback + tempo scaling (Phase 4)
    PcmRecorder.{cpp,h}     # PCM tap → file                (Phase 3)
    NativeAudioEngine.{cpp,h} # C++ TurboModule (JSI bindings)
  jni/                      # RN app-level CMake + OnLoad override
    CMakeLists.txt
    OnLoad.cpp
  java/com/music/
    audio/                  # Kotlin glue, lifecycle, audio focus
    keyboard/               # (Option B) native key view, if needed
  assets/
    soundfonts/             # piano.sf2, etc.  (Phase 1+)
    songs/                  # happy_birthday.mid, ...        (Phase 4)
src/
  specs/                    # TurboModule codegen specs (e.g. NativeAudioEngine.ts)
  audio/                    # AudioModule.ts (typed JSI iface), useAudioEngine.ts
  components/               # keyboard/ transport/ controls/ instruments/ songs/ ads/
  screens/                  # PlayerScreen.tsx, RecordingsScreen.tsx
  store/                    # Zustand slices (instrument, settings, recording)
  domain/                   # notes.ts, midi.ts, recording.ts
  services/                 # storage.ts (MMKV+FS), permissions.ts
  theme/                    # neon/glow design tokens
  App.tsx
```

## 6. Performance & quality guardrails (apply continuously)

- Memoize `Key` components; never re-render the whole keyboard on one keypress.
- Never debounce `noteOn`/`noteOff` themselves (only debounce *visual* updates).
- Load the SoundFont once; don't reload on instrument switch.
- Audio focus & lifecycle: duck/pause on calls & backgrounding; release Oboe on stop; rebuild on resume.
- Stop the audio stream when truly idle (no held notes, not recording) for battery/thermals.
- Verify any shipped `.sf2`'s license allows commercial distribution before release. (roadmap §4, §8)

---

**If you are an AI session reading this for the first time: do not start coding features.
Check `TASK.md` → "Resume Here" for the current phase, and only work within that phase.**
