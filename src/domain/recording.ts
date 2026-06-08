/**
 * Event-recording model for "RECORD KEYS".
 *
 * This records *events* (note on/off with timestamps), NOT audio — tiny,
 * editable, and replayed through the same synth. (The separate "REC As Sound"
 * feature captures rendered PCM; do not conflate them — see CLAUDE.md §4.)
 */

export interface RecEvent {
  /** Milliseconds from the start of the recording. */
  t: number;
  type: 'on' | 'off';
  midi: number;
  /** Velocity 0..1, present for 'on' events. */
  vel?: number;
}

export interface Recording {
  id: string;
  name: string;
  events: RecEvent[];
  durationMs: number;
  createdAt: number; // epoch ms
}

export function newRecordingId(): string {
  return `rk_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** "0:04" style mm:ss from milliseconds. */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
