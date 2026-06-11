/**
 * userSongsStore — songs the user has uploaded (parsed from .mid files).
 * Persisted as the parsed Song data so they survive restarts and appear in the
 * song picker alongside the built-in songs.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '../services/storage';
import type { Song } from '../domain/song';

interface UserSongsState {
  songs: Song[];
  addSong: (song: Song) => void;
  removeSong: (id: string) => void;
}

export const useUserSongsStore = create<UserSongsState>()(
  persist(
    (set) => ({
      songs: [],
      addSong: (song) =>
        set((s) => ({ songs: [song, ...s.songs.filter((x) => x.id !== song.id)] })),
      removeSong: (id) => set((s) => ({ songs: s.songs.filter((x) => x.id !== id) })),
    }),
    { name: 'user-songs', storage: zustandStorage },
  ),
);

/** Look up a user song by id (non-reactive). */
export function userSongById(id: string): Song | undefined {
  return useUserSongsStore.getState().songs.find((s) => s.id === id);
}
