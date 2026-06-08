/**
 * Note math: MIDI number <-> name/solfège, white/black classification, ranges.
 * Pure, dependency-free, and unit-testable (used by the keyboard + later by MIDI).
 *
 * MIDI reference: middle C = C4 = MIDI 60.
 */

export type Notation = 'western' | 'solfege';

// Indexed by pitch class (midi % 12): C C# D D# E F F# G G# A A# B
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false] as const;
const WESTERN_LETTER = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const;
const SOLFEGE_LETTER = ['Do', 'Do', 'Re', 'Re', 'Mi', 'Fa', 'Fa', 'Sol', 'Sol', 'La', 'La', 'Si'] as const;

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isBlackKey(midi: number): boolean {
  return IS_BLACK[pitchClass(midi)];
}

export function isWhiteKey(midi: number): boolean {
  return !isBlackKey(midi);
}

/** Octave number in scientific pitch notation (C4 = middle C). */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** True for the C of each octave — highlighted in the UI like the reference. */
export function isC(midi: number): boolean {
  return pitchClass(midi) === 0;
}

/** Letter/solfège name without octave, including a trailing # for black keys. */
export function noteLetter(midi: number, notation: Notation): string {
  const pc = pitchClass(midi);
  const base = notation === 'solfege' ? SOLFEGE_LETTER[pc] : WESTERN_LETTER[pc];
  return IS_BLACK[pc] ? `${base}#` : base;
}

/** Full label as shown under a key, e.g. "C4" / "Do4". */
export function noteLabel(midi: number, notation: Notation): string {
  return `${noteLetter(midi, notation)}${octaveOf(midi)}`;
}

/** Inclusive list of MIDI numbers in [lowMidi, highMidi]. */
export function midiRange(lowMidi: number, highMidi: number): number[] {
  const out: number[] = [];
  for (let m = lowMidi; m <= highMidi; m++) out.push(m);
  return out;
}

/** Just the white keys in a range (used for keyboard geometry). */
export function whiteKeysInRange(lowMidi: number, highMidi: number): number[] {
  return midiRange(lowMidi, highMidi).filter(isWhiteKey);
}

// Common note constants.
export const MIDI_C3 = 48;
export const MIDI_C4 = 60; // middle C
export const MIDI_C6 = 84;
