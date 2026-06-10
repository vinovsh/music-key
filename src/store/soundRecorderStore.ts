/**
 * soundRecorderStore — state for "REC As Sound" (audio .m4a recordings).
 * The files live on disk (managed natively); this caches the list + record state.
 */
import { create } from 'zustand';
import { SoundRecorder, type SoundRecording } from '../audio/soundRecorder';

interface SoundRecorderState {
  isRecording: boolean;
  startedAt: number;
  recordings: SoundRecording[];
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export const useSoundRecorderStore = create<SoundRecorderState>((set, get) => ({
  isRecording: false,
  startedAt: 0,
  recordings: [],

  refresh: async () => {
    try {
      const recordings = await SoundRecorder.list();
      set({ recordings });
    } catch {
      // ignore (module unavailable / no dir yet)
    }
  },

  start: async () => {
    try {
      await SoundRecorder.start();
      set({ isRecording: true, startedAt: Date.now() });
    } catch {
      set({ isRecording: false });
    }
  },

  stop: async () => {
    if (!get().isRecording) return;
    // Flip UI state immediately so the button switches back to REC without
    // waiting for the native stop + AAC encode (which can take a moment).
    set({ isRecording: false, startedAt: 0 });
    try {
      await SoundRecorder.stop();
    } catch {
      // ignore
    }
    await get().refresh();
  },
}));
