/**
 * songPlayer — JS sequencer for bundled songs.
 *
 * Schedules each note's on/off with timers, scaled by `speed` (tempo control).
 * Calls the raw engine functions (not the performer) so auto-play isn't recorded.
 * Reports the set of currently-sounding notes via onActive for key highlighting.
 * Auto-play is not latency-critical, so timer-based scheduling is fine.
 */
import { noteOn, noteOff } from './audio';
import type { Song } from '../domain/song';

interface PlayOpts {
  speed: number; // 1.0 = original tempo
  onActive?: (active: ReadonlySet<number>) => void;
  onDone?: () => void;
}

let timers: ReturnType<typeof setTimeout>[] = [];
let endTimer: ReturnType<typeof setTimeout> | null = null;
const sounding = new Set<number>();
let onActiveCb: ((a: ReadonlySet<number>) => void) | null = null;
let onDoneCb: (() => void) | null = null;

export function isPlaying(): boolean {
  return endTimer !== null;
}

export function play(song: Song, opts: PlayOpts): void {
  stop();
  const speed = opts.speed > 0 ? opts.speed : 1;
  onActiveCb = opts.onActive ?? null;
  onDoneCb = opts.onDone ?? null;

  for (const n of song.notes) {
    timers.push(
      setTimeout(() => {
        noteOn(n.midi, n.vel);
        sounding.add(n.midi);
        emit();
      }, n.startMs / speed),
    );
    timers.push(
      setTimeout(() => {
        noteOff(n.midi);
        sounding.delete(n.midi);
        emit();
      }, (n.startMs + n.durMs) / speed),
    );
  }

  endTimer = setTimeout(finish, song.durationMs / speed + 200);
}

export function stop(): void {
  clearTimers();
  releaseAll();
  if (endTimer !== null) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  emit();
  fireDone();
}

function finish(): void {
  clearTimers();
  releaseAll();
  endTimer = null;
  emit();
  fireDone();
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
function releaseAll(): void {
  for (const m of sounding) noteOff(m);
  sounding.clear();
}
function emit(): void {
  if (onActiveCb) onActiveCb(new Set(sounding));
}
function fireDone(): void {
  const cb = onDoneCb;
  onDoneCb = null;
  if (cb) cb();
}
