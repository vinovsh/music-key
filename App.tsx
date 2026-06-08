/**
 * Realistic Piano — App root (Phase 1).
 *
 * The native audio engine (Oboe + TinySoundFont) is started and the SoundFont
 * loaded from assets in MainApplication.onCreate (Kotlin), so sound is ready
 * before the first frame. JS only plays notes via synchronous JSI (CLAUDE.md §1).
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PlayerScreen from './src/screens/PlayerScreen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0c0a1a" />
      <PlayerScreen />
    </SafeAreaProvider>
  );
}

export default App;
