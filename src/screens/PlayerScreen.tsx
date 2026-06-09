/**
 * PlayerScreen — Phase 2 layout (instruments, notation, zoom, mini-keyboard).
 *
 * Still no recording/songs/ads (Phases 3–5). Fullscreen hides the chrome and
 * leaves the keyboard + a slim nav strip (so you can exit fullscreen).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Keyboard from '../components/keyboard/Keyboard';
import MiniKeyboard from '../components/keyboard/MiniKeyboard';
import ZoomControls from '../components/keyboard/ZoomControls';
import InstrumentSelector from '../components/instruments/InstrumentSelector';
import NotationToggle from '../components/songs/NotationToggle';
import SongControl from '../components/songs/SongControl';
import RecordKeysControls from '../components/transport/RecordKeysControls';
import SoundRecordButton from '../components/transport/SoundRecordButton';
import RecordingsModal from '../components/recordings/RecordingsModal';
import SettingsModal from '../components/settings/SettingsModal';
import AdBanner from '../components/ads/AdBanner';
import { useSettingsStore } from '../store/settingsStore';
import { useInstrumentStore } from '../store/instrumentStore';
import { useKeyboardStore } from '../store/keyboardStore';
import { setMasterGain } from '../audio/audio';
import { colors } from '../theme/colors';

function PlayerScreen() {
  const insets = useSafeAreaInsets();

  const notation = useSettingsStore((s) => s.notation);

  // The keyboard now reads zoom + scroll itself, so PlayerScreen no longer
  // re-renders as the window moves — only fullscreen affects this layout.
  const fullscreen = useKeyboardStore((s) => s.fullscreen);

  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Push the initial volume + instrument to the engine once on mount (engine
  // starts at unity gain / default preset; align it to the UI state).
  useEffect(() => {
    setMasterGain(useSettingsStore.getState().volume);
    useInstrumentStore.getState().syncToEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: (fullscreen ? 4 : insets.top + 6),
          paddingBottom: insets.bottom + 6,
        },
      ]}>
      {/* App runs fully immersive — the system status bar stays hidden so the UI
          uses the whole screen (the bar reappears transiently on edge swipe). */}
      <StatusBar hidden barStyle="light-content" />
      {!fullscreen && (
        <>
          <View style={styles.topBar}>
            <Text style={styles.brand}>
              Piano<Text style={styles.accent}> · Phase 5</Text>
            </Text>

            <View style={styles.recBtnWrap}>
              <SoundRecordButton />
            </View>

            <Pressable style={styles.listBtn} onPress={() => setRecordingsOpen(true)}>
              <Text style={styles.listBtnText}>☰ LIST</Text>
            </Pressable>

            {/* Volume + Speed now live in the Settings (gear) menu. */}
            <View style={styles.topBarSpacer} />

            <View style={styles.songControlWrap}>
              <SongControl />
            </View>

            <Pressable style={styles.gearBtn} onPress={() => setSettingsOpen(true)}>
              <Text style={styles.gearText}>⚙</Text>
            </Pressable>
          </View>

          <View style={styles.instrumentRow}>
            <InstrumentSelector />
            <NotationToggle />
          </View>
        </>
      )}

      {/* Navigation strip: record/play + mini-keyboard + key-size/fullscreen. */}
      <View style={styles.navStrip}>
        {!fullscreen && (
          <View style={styles.recWrap}>
            <RecordKeysControls />
          </View>
        )}
        <View style={styles.miniWrap}>
          <MiniKeyboard />
        </View>
        <ZoomControls />
      </View>

      <View style={styles.keyboardWrap}>
        <Keyboard notation={notation} />
      </View>

      {!fullscreen && <AdBanner />}

      {fullscreen && (
        <Pressable
          style={styles.exitFs}
          onPress={() => useKeyboardStore.getState().toggleFullscreen()}>
          <Text style={styles.exitFsText}>✕</Text>
        </Pressable>
      )}

      <RecordingsModal
        visible={recordingsOpen}
        onClose={() => setRecordingsOpen(false)}
      />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  brand: { color: colors.text, fontSize: 17, fontWeight: '800', marginRight: 12 },
  accent: { color: colors.accent },
  listBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  listBtnText: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  recBtnWrap: { marginRight: 10 },
  topBarSpacer: { flex: 1 },
  songControlWrap: { marginLeft: 12 },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  gearText: { color: colors.textDim, fontSize: 18 },

  instrumentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  navStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recWrap: { marginRight: 12 },
  miniWrap: { flex: 1, marginRight: 12 },

  keyboardWrap: { flex: 1 },

  exitFs: {
    position: 'absolute',
    top: 6,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitFsText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});

export default PlayerScreen;
