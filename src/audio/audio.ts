/**
 * Thin typed wrapper over the NativeAudioEngine TurboModule.
 *
 * Centralises the one sanctioned audio entry point so UI code imports from here.
 * Every call is a SYNCHRONOUS JSI hop into C++ (CLAUDE.md §1) — call these
 * directly from touch handlers; never route sound through React state.
 */
import NativeAudioEngine from '../specs/NativeAudioEngine';

/** Start a note. pitch = MIDI number, velocity = 0..1. */
export function noteOn(pitch: number, velocity: number): void {
  NativeAudioEngine.noteOn(pitch, velocity);
}

/** Release a note. pitch = MIDI number. */
export function noteOff(pitch: number): void {
  NativeAudioEngine.noteOff(pitch);
}

/** Master output gain, 0..1 (linear). */
export function setMasterGain(gain: number): void {
  NativeAudioEngine.setMasterGain(gain);
}

/** Switch instrument by SoundFont bank-0 preset number. */
export function setProgram(preset: number): void {
  NativeAudioEngine.setProgram(preset);
}

/** Sustain pedal on/off. */
export function setSustain(on: boolean): void {
  NativeAudioEngine.setSustain(on);
}
