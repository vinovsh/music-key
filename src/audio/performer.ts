/**
 * Performer — the single entry point the keyboard uses to play notes.
 *
 * It calls the engine (synchronous JSI) AND, if a "RECORD KEYS" recording is in
 * progress, captures the event. Keeping this in one place means recording is
 * transparent to the keyboard and we never double-record during replay (replay
 * calls the raw engine functions in audio.ts directly).
 *
 * RING-OUT (sustain): the fade-out after a key release is done in the NATIVE
 * synth — its amp-envelope release time equals the "Ring time" setting (pushed
 * via setReleaseTime from settingsStore). So we send noteOff IMMEDIATELY here and
 * the engine fades the voice over Ring time. This works for every instrument,
 * including decaying ones (piano) where delaying noteOff in JS had no effect.
 */
import { noteOn, noteOff } from './audio';
import { useRecordingStore } from '../store/recordingStore';

export function playNoteOn(midi: number, velocity: number): void {
  noteOn(midi, velocity); // sound first (CLAUDE.md §1)
  useRecordingStore.getState().captureOn(midi, velocity);
}

export function playNoteOff(midi: number): void {
  noteOff(midi); // synth fades the voice over its release time (= Ring time)
  useRecordingStore.getState().captureOff(midi);
}
