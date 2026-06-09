/**
 * PlayerScreen — Phase 2 layout (instruments, notation, zoom, mini-keyboard).
 *
 * Still no recording/songs/ads (Phases 3–5). Fullscreen hides the chrome and
 * leaves the keyboard + a slim nav strip (so you can exit fullscreen).
 */
import React, { useCallback, useEffect, useState } from 'react';
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

  // SEQUENCE arrows: nudge the visible window left/right by a few white keys.
  const nudgeSequence = useCallback((dir: number) => {
    const st = useKeyboardStore.getState();
    st.setWindowStart(st.windowStart + dir * 4);
  }, []);

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
        <View style={styles.topBar}>
          <View style={styles.recBtnWrap}>
            <SoundRecordButton />
          </View>

          <Pressable style={styles.listBtn} onPress={() => setRecordingsOpen(true)}>
            <Text style={styles.listBtnText}>☰ LIST</Text>
          </Pressable>

          <View style={styles.instrumentsWrap}>
            <InstrumentSelector />
          </View>

          <View style={styles.topBarSpacer} />

          <View style={styles.songControlWrap}>
            <SongControl />
          </View>

          <Pressable style={styles.gearBtn} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>
      )}

      {/* Row 2: RECORD KEYS · SEQUENCE (‹ strip ›) · KEY SIZE · SHOW NOTES. */}
      <View style={styles.navStrip}>
        {!fullscreen && (
          <View style={styles.recWrap}>
            <RecordKeysControls />
          </View>
        )}

        <View style={styles.seqCard}>
          {!fullscreen && <Text style={styles.seqCaption}>SEQUENCE</Text>}
          <View style={styles.seqRow}>
            {!fullscreen && (
              <Pressable style={styles.seqArrow} onPress={() => nudgeSequence(-1)}>
                <Text style={styles.seqArrowText}>‹</Text>
              </Pressable>
            )}
            <View style={styles.miniWrap}>
              <MiniKeyboard />
            </View>
            {!fullscreen && (
              <Pressable style={styles.seqArrow} onPress={() => nudgeSequence(1)}>
                <Text style={styles.seqArrowText}>›</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.zoomWrap}>
          <ZoomControls />
        </View>

        {!fullscreen && (
          <View style={styles.notationWrap}>
            <NotationToggle />
          </View>
        )}
      </View>

      <View style={styles.keyboardWrap}>
        <Keyboard notation={notation} />
      </View>

      {!fullscreen && <AdBanner />}

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
  instrumentsWrap: { marginRight: 12 },
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

  navStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
  },
  recWrap: { marginRight: 10 },
  // SEQUENCE card grows to fill the middle; holds the arrows + mini-keyboard.
  seqCard: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  seqCaption: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  seqRow: { flexDirection: 'row', alignItems: 'center' },
  miniWrap: { flex: 1, marginHorizontal: 8 },
  seqArrow: {
    width: 28,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqArrowText: { color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 20 },
  zoomWrap: { marginLeft: 10 },
  notationWrap: { marginLeft: 10 },

  keyboardWrap: { flex: 1 },
});

export default PlayerScreen;
