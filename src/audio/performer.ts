/**
 * Performer — the single entry point the keyboard uses to play notes.
 *
 * It calls the engine (synchronous JSI) AND, if a "RECORD KEYS" recording is in
 * progress, captures the event. Keeping this in one place means recording is
 * transparent to the keyboard and we never double-record during replay (replay
 * calls the raw engine functions in audio.ts directly).
 *
 * RING-OUT (sustain): when Sustain is on, a released note isn't silenced
 * immediately — we defer the engine noteOff by `ringSec` seconds so the note
 * rings out, like lifting a sustain pedal after a beat. Re-pressing the same key
 * cancels its pending release (clean re-attack). The sound itself still starts
 * synchronously on press (CLAUDE.md §1); only the *release* is delayed.
 */
import { noteOn, noteOff } from './audio';
import { useRecordingStore } from '../store/recordingStore';
import { useSettingsStore } from '../store/settingsStore';

// midi -> pending ring-out release timer.
const ringTimers = new Map<number, ReturnType<typeof setTimeout>>();

function cancelRing(midi: number): void {
  const t = ringTimers.get(midi);
  if (t != null) {
    clearTimeout(t);
    ringTimers.delete(midi);
  }
}

export function playNoteOn(midi: number, velocity: number): void {
  cancelRing(midi); // re-attack: drop any pending ring-out release
  noteOn(midi, velocity); // sound first (CLAUDE.md §1)
  useRecordingStore.getState().captureOn(midi, velocity);
}

export function playNoteOff(midi: number): void {
  // Record the key release at its real time (RECORD KEYS = key events).
  useRecordingStore.getState().captureOff(midi);

  const { sustain, ringSec } = useSettingsStore.getState();
  if (sustain && ringSec > 0) {
    cancelRing(midi);
    ringTimers.set(
      midi,
      setTimeout(() => {
        ringTimers.delete(midi);
        noteOff(midi);
      }, ringSec * 1000),
    );
  } else {
    noteOff(midi);
  }
}
