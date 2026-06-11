/**
 * MIDI import — turn a .mid file's bytes into our timed Song format so uploaded
 * songs play through the same JS sequencer + synth as the built-in ones (keys
 * light up, current instrument is used). Uses @tonejs/midi (pure JS) which
 * resolves tempo maps for us, so each note already has absolute time/duration.
 */
import { Midi } from '@tonejs/midi';
import type { Song, SongNote } from './song';

// Auto-play schedules 2 timers per note up-front; cap very dense files so a huge
// MIDI can't flood the timer queue.
const MAX_NOTES = 4000;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Build a Song from raw MIDI bytes. Drops the percussion track (channel 10),
 * flattens every melodic track into one note list, and caps the note count.
 * Throws if the file has no playable notes.
 */
export function songFromMidiBytes(data: ArrayBuffer, id: string, title: string): Song {
  const midi = new Midi(data);
  const notes: SongNote[] = [];

  for (const track of midi.tracks) {
    if (track.instrument?.percussion) continue; // skip drums (channel 10)
    for (const n of track.notes) {
      if (n.midi < 0 || n.midi > 127) continue;
      notes.push({
        midi: n.midi,
        startMs: Math.round(n.time * 1000),
        durMs: Math.max(60, Math.round(n.duration * 1000)),
        vel: clamp01(n.velocity || 0.8),
      });
    }
  }

  if (notes.length === 0) {
    throw new Error('No playable notes found in this MIDI file.');
  }

  notes.sort((a, b) => a.startMs - b.startMs);
  const trimmed = notes.length > MAX_NOTES ? notes.slice(0, MAX_NOTES) : notes;
  const durationMs = trimmed.reduce((m, n) => Math.max(m, n.startMs + n.durMs), 0);

  return { id, title, notes: trimmed, durationMs };
}
