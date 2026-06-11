/**
 * songImport — let the user pick a .mid file and turn it into a Song.
 *
 * Uses @dr.pogodin/react-native-fs for BOTH the file picker (pickFile) and
 * reading the bytes (readFile as base64). One native dependency; the MIDI parse
 * + conversion is pure JS (domain/midi). Guarded so a missing native module
 * (e.g. in tests) never throws at import time.
 */
import { songFromMidiBytes } from '../domain/midi';
import type { Song } from '../domain/song';

// MIME types Android/iOS use for MIDI files.
const MIDI_MIME_TYPES = ['audio/midi', 'audio/x-midi', 'application/x-midi'];

// Standard base64 alphabet → reverse lookup (avoids relying on atob in Hermes).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

function base64ToBytes(b64: string): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let val = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = B64_LOOKUP[b64.charCodeAt(i)];
    if (c === -1) continue; // skip '=', whitespace, newlines
    val = (val << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((val >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function titleFromUri(uri: string): string {
  try {
    const last = decodeURIComponent(uri.split('?')[0].split('/').pop() ?? '');
    const name = last.replace(/\.midi?$/i, '').trim();
    return name || 'Imported song';
  } catch {
    return 'Imported song';
  }
}

let fs: typeof import('@dr.pogodin/react-native-fs') | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fs = require('@dr.pogodin/react-native-fs');
} catch {
  fs = undefined;
}

export const songImportAvailable = !!fs?.pickFile;

/**
 * Open the system file picker for a .mid file and return a parsed Song.
 * Returns null if the user cancelled (or the picker is unavailable).
 * Throws if the chosen file can't be read or isn't valid MIDI.
 */
export async function importMidiSong(): Promise<Song | null> {
  if (!fs?.pickFile) return null;

  let uris: string[];
  try {
    uris = await fs.pickFile({ mimeTypes: MIDI_MIME_TYPES, pickerType: 'singleFile' });
  } catch {
    return null; // user cancelled
  }
  const uri = uris?.[0];
  if (!uri) return null;

  const b64 = await fs.readFile(uri, 'base64');
  const bytes = base64ToBytes(b64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  const id = `user_${Date.now()}`;
  return songFromMidiBytes(buffer as ArrayBuffer, id, titleFromUri(uri));
}
