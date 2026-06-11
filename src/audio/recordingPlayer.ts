/**
 * recordingPlayer — replays a "RECORD KEYS" recording through the synth.
 *
 * Schedules each event with a timer relative to its timestamp and calls the raw
 * engine functions (NOT the performer) so replay isn't re-recorded. Tracks
 * sounding notes so stop/finish can release everything cleanly.
 */
import { noteOn, noteOff } from './audio';
import { usePlaybackStore } from '../store/playbackStore';
import type { Recording } from '../domain/recording';

let timers: ReturnType<typeof setTimeout>[] = [];
const sounding = new Set<number>();
let endTimer: ReturnType<typeof setTimeout> | null = null;
let doneCb: (() => void) | null = null;

export function isPlaying(): boolean {
  return endTimer !== null;
}

export function playRecording(rec: Recording, onDone?: () => void): void {
  stopPlayback(); // clean slate
  doneCb = onDone ?? null;

  for (const e of rec.events) {
    const id = setTimeout(() => {
      if (e.type === 'on') {
        noteOn(e.midi, e.vel ?? 0.8);
        sounding.add(e.midi);
      } else {
        noteOff(e.midi);
        sounding.delete(e.midi);
      }
      emit(); // light up the played notes on both keyboards
    }, e.t);
    timers.push(id);
  }

  endTimer = setTimeout(finish, rec.durationMs + 50);
}

export function stopPlayback(): void {
  clearTimers();
  releaseAll();
  if (endTimer !== null) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  fireDone();
}

function finish(): void {
  clearTimers();
  releaseAll();
  endTimer = null;
  fireDone();
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function releaseAll(): void {
  for (const m of sounding) noteOff(m);
  sounding.clear();
  emit(); // clear the highlight
}

function emit(): void {
  usePlaybackStore.getState().setActive(new Set(sounding));
}

function fireDone(): void {
  const cb = doneCb;
  doneCb = null;
  if (cb) cb();
}
