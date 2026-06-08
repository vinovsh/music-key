/**
 * Song model for the library + auto-play.
 *
 * NOTE (deviation from the roadmap, recorded in TASK.md): songs are authored as
 * timed note data in TS and played by a JS sequencer, rather than parsed from
 * bundled .mid files driven by a native sequencer. Auto-play is NOT
 * latency-critical (it doesn't respond to taps), so JS scheduling is fine and
 * avoids binary-asset loading + native-sequencer complexity. A real .mid parser
 * (domain/midi.ts) + native sequencer can replace this later without UI changes.
 */

export interface SongNote {
  midi: number;
  startMs: number; // at 1.0x speed
  durMs: number; // at 1.0x speed
  vel: number; // 0..1
}

export interface Song {
  id: string;
  title: string;
  notes: SongNote[];
  /** Total length at 1.0x, ms. */
  durationMs: number;
}

/** A monophonic melody entry: a MIDI note (or null = rest) lasting `beats`. */
export interface MelodyStep {
  midi: number | null;
  beats: number;
}

/**
 * Build a Song from a simple monophonic melody (note + beats) at a given tempo.
 * Notes are slightly detached (90% of the slot) so repeats are audible.
 */
export function songFromMelody(
  id: string,
  title: string,
  bpm: number,
  steps: MelodyStep[],
  vel = 0.85,
): Song {
  const msPerBeat = 60000 / bpm;
  const notes: SongNote[] = [];
  let t = 0;
  for (const step of steps) {
    const slot = step.beats * msPerBeat;
    if (step.midi != null) {
      notes.push({
        midi: step.midi,
        startMs: t,
        durMs: Math.max(60, slot * 0.9),
        vel,
      });
    }
    t += slot;
  }
  return { id, title, notes, durationMs: t };
}
