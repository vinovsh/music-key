/**
 * playbackStore — song auto-play transport + which notes are sounding (for the
 * keyboard's playback highlight). Speed comes from settingsStore at play time.
 */
import { create } from 'zustand';
import * as songPlayer from '../audio/songPlayer';
import { SONGS, songById } from '../domain/songs';
import { useSettingsStore } from './settingsStore';

interface PlaybackState {
  isPlaying: boolean;
  selectedId: string;
  active: ReadonlySet<number>;
  setSong: (id: string) => void;
  toggle: () => void;
  stop: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  selectedId: SONGS[0].id,
  active: new Set(),

  setSong: (id) => {
    songPlayer.stop();
    set({ selectedId: id, isPlaying: false, active: new Set() });
  },

  toggle: () => {
    if (get().isPlaying) {
      get().stop();
      return;
    }
    const song = songById(get().selectedId);
    const speed = useSettingsStore.getState().speed;
    set({ isPlaying: true });
    songPlayer.play(song, {
      speed,
      onActive: (active) => set({ active }),
      onDone: () => set({ isPlaying: false, active: new Set() }),
    });
  },

  stop: () => {
    songPlayer.stop();
    set({ isPlaying: false, active: new Set() });
  },
}));
