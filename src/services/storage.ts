/**
 * Persistence backing for Zustand stores (settings, instrument, keyboard,
 * recordings). Uses AsyncStorage; audio files themselves live on the filesystem.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

export const zustandStorage = createJSONStorage(() => AsyncStorage);
