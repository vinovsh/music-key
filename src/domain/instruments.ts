/**
 * Instrument catalogue.
 *
 * Each instrument maps to a bank-0 PRESET NUMBER inside the loaded SoundFont.
 * These preset numbers are specific to the current dev SoundFont
 * (florestan-subset.sf2) — they are NOT standard General MIDI numbers.
 * When we ship a GM SoundFont, switch these to GM programs
 * (Piano 0, Church Organ 19, Nylon Guitar 24, Flute 73, etc.).
 */
export type InstrumentId = 'piano' | 'flute' | 'organ' | 'guitar';

export interface Instrument {
  id: InstrumentId;
  label: string;
  preset: number; // bank-0 preset number in the SoundFont
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'piano', label: 'Piano', preset: 2 },   // "Piano"
  { id: 'flute', label: 'Flute', preset: 75 },  // "Pan Flute"
  { id: 'organ', label: 'Organ', preset: 19 },  // "Church Org.1"
  { id: 'guitar', label: 'Guitar', preset: 24 }, // "Nylon-str.Gt"
];

export const DEFAULT_INSTRUMENT: InstrumentId = 'piano';

export function instrumentById(id: InstrumentId): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}
