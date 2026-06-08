/**
 * recordingStore — "RECORD KEYS" event recorder state + saved recordings.
 *
 * Captures note events with timestamps while recording. The performer layer
 * (audio/performer.ts) calls captureOn/captureOff so recording is transparent to
 * the keyboard. Recordings are in-memory for now (persistence is a later step).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '../services/storage';
import {
  formatDuration,
  newRecordingId,
  type RecEvent,
  type Recording,
} from '../domain/recording';

interface RecordingState {
  isRecording: boolean;
  startedAt: number; // epoch ms when recording began
  current: RecEvent[];
  recordings: Recording[];

  startRecording: () => void;
  /** Stops and saves (if any events were captured). Returns the new recording. */
  stopRecording: () => Recording | null;

  // Called by the performer on every note (only stored while recording).
  captureOn: (midi: number, vel: number) => void;
  captureOff: (midi: number) => void;

  deleteRecording: (id: string) => void;
  renameRecording: (id: string, name: string) => void;
}

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set, get) => ({
  isRecording: false,
  startedAt: 0,
  current: [],
  recordings: [],

  startRecording: () =>
    set({ isRecording: true, startedAt: Date.now(), current: [] }),

  stopRecording: () => {
    const { isRecording, current, startedAt, recordings } = get();
    if (!isRecording) return null;
    if (current.length === 0) {
      set({ isRecording: false, current: [] });
      return null;
    }
    const durationMs = current[current.length - 1].t + 300; // small tail
    const rec: Recording = {
      id: newRecordingId(),
      name: `Recording ${recordings.length + 1}`,
      events: current,
      durationMs,
      createdAt: startedAt,
    };
    set({ isRecording: false, current: [], recordings: [rec, ...recordings] });
    return rec;
  },

  captureOn: (midi, vel) => {
    const { isRecording, startedAt, current } = get();
    if (!isRecording) return;
    current.push({ t: Date.now() - startedAt, type: 'on', midi, vel });
  },
  captureOff: (midi) => {
    const { isRecording, startedAt, current } = get();
    if (!isRecording) return;
    current.push({ t: Date.now() - startedAt, type: 'off', midi });
  },

  deleteRecording: (id) =>
    set((s) => ({ recordings: s.recordings.filter((r) => r.id !== id) })),
  renameRecording: (id, name) =>
    set((s) => ({
      recordings: s.recordings.map((r) => (r.id === id ? { ...r, name } : r)),
    })),
    }),
    {
      name: 'recordings',
      storage: zustandStorage,
      // Only persist saved takes (not the in-flight recording buffer).
      partialize: (s) => ({ recordings: s.recordings }),
    },
  ),
);

export { formatDuration };
