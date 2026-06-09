/**
 * settingsStore — UI/playback settings (Zustand, persisted via AsyncStorage).
 *
 * Holds master volume and notation. Volume changes push straight to the C++
 * engine via setMasterGain. This is NOT the audio hot-path — it's a control
 * value, so going through the store is fine. Notes never go through here.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '../services/storage';
import { setMasterGain, setReleaseTime } from '../audio/audio';
import type { Notation } from '../domain/notes';

export const RING_MIN = 0.25; // seconds
export const RING_MAX = 6.0;
// Short, click-free release used when Sustain is off (note stops promptly).
const OFF_RELEASE_SEC = 0.06;

// The synth's amp-envelope release = Ring time when sustaining, else a quick stop.
function releaseFor(sustain: boolean, ringSec: number): number {
  return sustain ? ringSec : OFF_RELEASE_SEC;
}

interface SettingsValues {
  volume: number; // 0..1
  speed: number; // playback tempo multiplier (1.0 = original)
  notation: Notation;
  showLabels: boolean; // note labels on the keys
  transpose: number; // semitones, -12..+12
  sustain: boolean; // when on, a released note rings out for `ringSec`
  ringSec: number; // ring-out tail after key release, in seconds
}

// Single source of truth for default values — used for the initial state AND the
// "Reset to defaults" action so they can never drift apart.
const DEFAULTS: SettingsValues = {
  volume: 0.6, // default 60%
  speed: 1.0, // normal tempo
  notation: 'western',
  showLabels: true,
  transpose: 0,
  sustain: true, // default ON: released notes ring out
  ringSec: 3.0, // default 3s ring-out tail
};

interface SettingsState extends SettingsValues {
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  setNotation: (n: Notation) => void;
  setShowLabels: (b: boolean) => void;
  setTranspose: (t: number) => void;
  setSustain: (b: boolean) => void;
  setRingSec: (s: number) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setVolume: (v) => {
        const clamped = Math.max(0, Math.min(1, v));
        setMasterGain(clamped);
        set({ volume: clamped });
      },
      setSpeed: (s) => set({ speed: Math.max(0.5, Math.min(2, s)) }),
      setNotation: (n) => set({ notation: n }),
      setShowLabels: (b) => set({ showLabels: b }),
      setTranspose: (t) => set({ transpose: Math.max(-12, Math.min(12, Math.round(t))) }),
      // Ring-out is the synth's amp-envelope release (setReleaseTime), so the
      // fade-out length tracks Ring time for every instrument. Sustain off = a
      // quick, click-free stop.
      setSustain: (b) => {
        setReleaseTime(releaseFor(b, get().ringSec));
        set({ sustain: b });
      },
      setRingSec: (s) => {
        const ringSec = Math.max(RING_MIN, Math.min(RING_MAX, s));
        setReleaseTime(releaseFor(get().sustain, ringSec));
        set({ ringSec });
      },
      // Restore every setting to its default and re-apply engine-affecting ones.
      resetToDefaults: () => {
        setMasterGain(DEFAULTS.volume);
        setReleaseTime(releaseFor(DEFAULTS.sustain, DEFAULTS.ringSec));
        set({ ...DEFAULTS });
      },
    }),
    {
      name: 'settings',
      storage: zustandStorage,
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState> | undefined;
        if (s) {
          // v1: sustain now defaults ON — flip it on for pre-v1 stores.
          if (version < 1) s.sustain = true;
          // v2: reset playback speed to normal (1.0×) for existing installs.
          if (version < 2) s.speed = 1.0;
        }
        return s as SettingsState;
      },
      partialize: (s) => ({
        volume: s.volume,
        speed: s.speed,
        notation: s.notation,
        showLabels: s.showLabels,
        transpose: s.transpose,
        sustain: s.sustain,
        ringSec: s.ringSec,
      }),
      // Re-apply persisted engine-affecting settings once the store rehydrates.
      // (Sustain/ring-out need no engine call — they're handled in the performer.)
      onRehydrateStorage: () => (state) => {
        if (state) {
          setMasterGain(state.volume);
          setReleaseTime(releaseFor(state.sustain, state.ringSec));
        }
      },
    },
  ),
);
