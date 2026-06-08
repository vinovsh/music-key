/**
 * Bundled songs for the library / auto-play.
 * Authored as monophonic melodies (MIDI note + beats) and compiled to timed
 * notes by songFromMelody. Middle C = 60.
 */
import { songFromMelody, type Song } from './song';

// Happy Birthday (key of C). G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 F5=77 G5=79.
const HAPPY_BIRTHDAY = songFromMelody('happy_birthday', 'Happy Birthday', 120, [
  { midi: 67, beats: 0.75 }, { midi: 67, beats: 0.25 }, { midi: 69, beats: 1 },
  { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 2 },
  { midi: 67, beats: 0.75 }, { midi: 67, beats: 0.25 }, { midi: 69, beats: 1 },
  { midi: 67, beats: 1 }, { midi: 74, beats: 1 }, { midi: 72, beats: 2 },
  { midi: 67, beats: 0.75 }, { midi: 67, beats: 0.25 }, { midi: 79, beats: 1 },
  { midi: 76, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
  { midi: 77, beats: 0.75 }, { midi: 77, beats: 0.25 }, { midi: 76, beats: 1 },
  { midi: 72, beats: 1 }, { midi: 74, beats: 1 }, { midi: 72, beats: 2 },
]);

// Twinkle Twinkle Little Star (key of C). C4=60 D=62 E=64 F=65 G=67 A=69.
const TWINKLE = songFromMelody('twinkle', 'Twinkle Twinkle', 120, [
  { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
  { midi: 69, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
  { midi: 65, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
  { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 },
  { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 65, beats: 1 },
  { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 2 },
  { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 65, beats: 1 },
  { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 2 },
  { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
  { midi: 69, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
  { midi: 65, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
  { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 },
]);

// Ode to Joy (key of C). E4=64 F=65 G=67 D=62 C=60.
const ODE_TO_JOY = songFromMelody('ode_to_joy', 'Ode to Joy', 110, [
  { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
  { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
  { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
  { midi: 64, beats: 1.5 }, { midi: 62, beats: 0.5 }, { midi: 62, beats: 2 },
  { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
  { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
  { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
  { midi: 62, beats: 1.5 }, { midi: 60, beats: 0.5 }, { midi: 60, beats: 2 },
]);

export const SONGS: Song[] = [HAPPY_BIRTHDAY, TWINKLE, ODE_TO_JOY];

export function songById(id: string): Song {
  return SONGS.find((s) => s.id === id) ?? SONGS[0];
}
