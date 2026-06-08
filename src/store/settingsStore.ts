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
import { setMasterGain, setSustain as engineSetSustain } from '../audio/audio';
import type { Notation } from '../domain/notes';

interface SettingsState {
  volume: number; // 0..1
  speed: number; // playback tempo multiplier (1.0 = original)
  notation: Notation;
  showLabels: boolean; // note labels on the keys
  transpose: number; // semitones, -12..+12
  sustain: boolean;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  setNotation: (n: Notation) => void;
  setShowLabels: (b: boolean) => void;
  setTranspose: (t: number) => void;
  setSustain: (b: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: 0.8, // matches the reference (80%)
      speed: 1.0,
      notation: 'western',
      showLabels: true,
      transpose: 0,
      sustain: false,
      setVolume: (v) => {
        const clamped = Math.max(0, Math.min(1, v));
        setMasterGain(clamped);
        set({ volume: clamped });
      },
      setSpeed: (s) => set({ speed: Math.max(0.5, Math.min(2, s)) }),
      setNotation: (n) => set({ notation: n }),
      setShowLabels: (b) => set({ showLabels: b }),
      setTranspose: (t) => set({ transpose: Math.max(-12, Math.min(12, Math.round(t))) }),
      setSustain: (b) => {
        engineSetSustain(b);
        set({ sustain: b });
      },
    }),
    {
      name: 'settings',
      storage: zustandStorage,
      partialize: (s) => ({
        volume: s.volume,
        speed: s.speed,
        notation: s.notation,
        showLabels: s.showLabels,
        transpose: s.transpose,
        sustain: s.sustain,
      }),
      // Re-apply persisted engine-affecting settings once the store rehydrates.
      onRehydrateStorage: () => (state) => {
        if (state) {
          setMasterGain(state.volume);
          if (state.sustain) engineSetSustain(true);
        }
      },
    },
  ),
);
