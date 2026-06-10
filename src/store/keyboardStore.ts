/**
 * keyboardStore — which slice of the keyboard is visible, zoom, and fullscreen.
 *
 * The main keyboard never scrolls (that would fight glissando/multi-touch).
 * Instead it renders a WINDOW of white keys; KEY SIZE +/- changes how many are
 * visible (zoom) and the mini-keyboard moves the window. This keeps hit-testing
 * trivial and input rock-solid.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '../services/storage';
import { whiteKeysInRange } from '../domain/notes';

const FULL_LOW = 21; // A0 — full 88-key piano (52 white + 36 black)
const FULL_HIGH = 108; // C8

// Stable list of every white key in the full range (used for windowing/minimap).
export const FULL_WHITE_KEYS = whiteKeysInRange(FULL_LOW, FULL_HIGH);
export const TOTAL_WHITE = FULL_WHITE_KEYS.length;

const MIN_VISIBLE = 8;
const MAX_VISIBLE = Math.min(24, TOTAL_WHITE);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface KeyboardState {
  visibleWhite: number; // how many white keys are on screen (zoom)
  windowStart: number; // index into FULL_WHITE_KEYS of the leftmost visible white
  fullscreen: boolean;

  zoomIn: () => void; // fewer keys -> bigger keys
  zoomOut: () => void; // more keys -> smaller keys
  setWindowStart: (i: number) => void;
  toggleFullscreen: () => void;
}

function clampStart(start: number, visible: number): number {
  return clamp(start, 0, Math.max(0, TOTAL_WHITE - visible));
}

export const useKeyboardStore = create<KeyboardState>()(
  persist(
    (set, get) => ({
      visibleWhite: 15, // ~F3.. by default (slightly bigger keys)
      windowStart: 19, // F3 (index into the full A0..C8 white-key list)
      fullscreen: false,

      zoomIn: () =>
        set((s) => {
          const visibleWhite = clamp(s.visibleWhite - 2, MIN_VISIBLE, MAX_VISIBLE);
          return { visibleWhite, windowStart: clampStart(s.windowStart, visibleWhite) };
        }),
      zoomOut: () =>
        set((s) => {
          const visibleWhite = clamp(s.visibleWhite + 2, MIN_VISIBLE, MAX_VISIBLE);
          return { visibleWhite, windowStart: clampStart(s.windowStart, visibleWhite) };
        }),
      setWindowStart: (i) => {
        // Skip no-op moves: the window snaps to integer white-key steps, so a
        // drag fires this ~60×/s but most land on the same index. Bailing out
        // avoids a needless re-render per move (the lag).
        const { windowStart, visibleWhite } = get();
        const next = clampStart(Math.round(i), visibleWhite);
        if (next !== windowStart) set({ windowStart: next });
      },
      toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
    }),
    {
      name: 'keyboard',
      storage: zustandStorage,
      // Remember the zoom (key size) only; the window always opens at F3 and
      // non-fullscreen.
      partialize: (s) => ({ visibleWhite: s.visibleWhite }),
    },
  ),
);

/** Visible [lowMidi, highMidi] derived from the window (inclusive white bounds). */
export function windowRange(visibleWhite: number, windowStart: number): {
  lowMidi: number;
  highMidi: number;
} {
  const start = clampStart(windowStart, visibleWhite);
  const lowMidi = FULL_WHITE_KEYS[start];
  const highMidi = FULL_WHITE_KEYS[Math.min(TOTAL_WHITE - 1, start + visibleWhite - 1)];
  return { lowMidi, highMidi };
}
