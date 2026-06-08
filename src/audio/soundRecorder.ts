/**
 * soundRecorder — JS wrapper over the native RecorderModule ("REC As Sound").
 *
 * Records the synth's rendered output to an .m4a file (PCM captured in C++,
 * encoded to AAC in Kotlin). Distinct from RECORD KEYS, which records events.
 * Guards against the module being absent (e.g. in tests) so imports never throw.
 */
import { NativeModules } from 'react-native';

export interface SoundRecording {
  path: string;
  name: string;
  durationMs: number;
  createdAt: number;
  size: number;
}

interface RecorderNative {
  startSoundRecording(): Promise<void>;
  stopSoundRecording(): Promise<SoundRecording>;
  listRecordings(): Promise<SoundRecording[]>;
  deleteRecording(path: string): Promise<void>;
  renameRecording(path: string, name: string): Promise<string>;
  playRecording(path: string): Promise<void>;
  stopPlayback(): Promise<void>;
  shareRecording(path: string): Promise<void>;
}

const native: RecorderNative | undefined = NativeModules.RecorderModule;

function ensure(): RecorderNative {
  if (!native) throw new Error('RecorderModule is not available');
  return native;
}

export const SoundRecorder = {
  available: !!native,
  start: () => ensure().startSoundRecording(),
  stop: () => ensure().stopSoundRecording(),
  list: () => (native ? native.listRecordings() : Promise.resolve([])),
  remove: (path: string) => ensure().deleteRecording(path),
  rename: (path: string, name: string) => ensure().renameRecording(path, name),
  play: (path: string) => ensure().playRecording(path),
  stopPlayback: () => (native ? native.stopPlayback() : Promise.resolve()),
  share: (path: string) => ensure().shareRecording(path),
};
