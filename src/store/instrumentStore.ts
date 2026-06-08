/**
 * instrumentStore — which instrument is selected (persisted via AsyncStorage).
 *
 * Switching instruments is a SoundFont program change in the C++ engine
 * (setProgram). One synth, many presets — never separate engines (CLAUDE.md §3).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '../services/storage';
import { setProgram } from '../audio/audio';
import {
  DEFAULT_INSTRUMENT,
  instrumentById,
  type InstrumentId,
} from '../domain/instruments';

interface InstrumentState {
  selected: InstrumentId;
  setInstrument: (id: InstrumentId) => void;
  /** Push the current selection to the engine (call once after mount). */
  syncToEngine: () => void;
}

export const useInstrumentStore = create<InstrumentState>()(
  persist(
    (set, get) => ({
      selected: DEFAULT_INSTRUMENT,
      setInstrument: (id) => {
        setProgram(instrumentById(id).preset);
        set({ selected: id });
      },
      syncToEngine: () => {
        setProgram(instrumentById(get().selected).preset);
      },
    }),
    {
      name: 'instrument',
      storage: zustandStorage,
      partialize: (s) => ({ selected: s.selected }),
      onRehydrateStorage: () => (state) => {
        if (state) setProgram(instrumentById(state.selected).preset);
      },
    },
  ),
);
