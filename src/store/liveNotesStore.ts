/**
 * liveNotesStore — the set of VISUAL keys currently held by touch on the main
 * keyboard. The keyboard publishes it (from its glow reconcile) so other views —
 * the mini-keyboard overview — can highlight where you're pressing without the
 * keyboard having to know about them. Holds visual key numbers (pre-transpose),
 * matching how both keyboards lay out FULL_WHITE_KEYS.
 */
import { create } from 'zustand';

interface LiveNotesState {
  active: ReadonlySet<number>;
  setActive: (a: ReadonlySet<number>) => void;
}

export const useLiveNotesStore = create<LiveNotesState>((set) => ({
  active: new Set(),
  setActive: (active) => set({ active }),
}));
