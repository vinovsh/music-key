/**
 * NativeAudioEngine — TurboModule spec (codegen source).
 *
 * Every method here is a SYNCHRONOUS JSI call straight into the C++ engine
 * (android/app/src/main/cpp/NativeAudioEngine.cpp). This is the ONLY sanctioned
 * audio path — never trigger sound through React state or the async bridge
 * (CLAUDE.md §1). Calls are fire-and-forget: they enqueue a lock-free event for
 * the audio thread and return immediately.
 *
 * Phase 2 will add instrument/program switching; Phase 4 adds transport.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Start a note. pitch = MIDI note number, velocity = 0..1. */
  noteOn(pitch: number, velocity: number): void;
  /** Release a note. pitch = MIDI note number. */
  noteOff(pitch: number): void;
  /** Master output gain, 0..1 (linear). Driven by the Volume slider. */
  setMasterGain(gain: number): void;
  /** Switch instrument: select a bank-0 preset number in the loaded SoundFont. */
  setProgram(preset: number): void;
  /** Sustain pedal: when on, released notes ring until sustain is turned off. */
  setSustain(on: boolean): void;
  /**
   * Ring-out: the amp-envelope release (seconds) the synth applies to each voice
   * on note-off, so "Ring time" controls the fade-out for any instrument.
   */
  setReleaseTime(seconds: number): void;
  /**
   * Panic / hard stop: immediately silence every sounding voice, ignoring the
   * sustain pedal and ring-out release. Unlike noteOff (which starts a fade),
   * this cuts the sound at once — used by Stop so playback halts instantly.
   */
  allSoundOff(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeAudioEngine');
