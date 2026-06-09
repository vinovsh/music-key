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
export const RING_MAX = 3.0;
// Short, click-free release used when Sustain is off (note stops promptly).
const OFF_RELEASE_SEC = 0.06;

// The synth's amp-envelope release = Ring time when sustaining, else a quick stop.
function releaseFor(sustain: boolean, ringSec: number): number {
  return sustain ? ringSec : OFF_RELEASE_SEC;
}

interface SettingsState {
  volume: number; // 0..1
  speed: number; // playback tempo multiplier (1.0 = original)
  notation: Notation;
  showLabels: boolean; // note labels on the keys
  transpose: number; // semitones, -12..+12
  sustain: boolean; // when on, a released note rings out for `ringSec`
  ringSec: number; // ring-out tail after key release, in seconds
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  setNotation: (n: Notation) => void;
  setShowLabels: (b: boolean) => void;
  setTranspose: (t: number) => void;
  setSustain: (b: boolean) => void;
  setRingSec: (s: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      volume: 0.8, // matches the reference (80%)
      speed: 1.0,
      notation: 'western',
      showLabels: true,
      transpose: 0,
      sustain: true, // default ON: released notes ring out
      ringSec: 1.0, // default 1s ring-out tail
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
    }),
    {
      name: 'settings',
      storage: zustandStorage,
      version: 1,
      // v1: sustain now defaults ON — flip it on for pre-v1 persisted stores so
      // existing installs match the new default (one-time).
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState> | undefined;
        if (version < 1 && s) {
          s.sustain = true;
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
