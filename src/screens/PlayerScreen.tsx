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
import Slider from '../components/controls/Slider';
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
import { useKeyboardStore, windowRange } from '../store/keyboardStore';
import { setMasterGain } from '../audio/audio';
import { colors } from '../theme/colors';

function PlayerScreen() {
  const insets = useSafeAreaInsets();

  const volume = useSettingsStore((s) => s.volume);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const speed = useSettingsStore((s) => s.speed);
  const setSpeed = useSettingsStore((s) => s.setSpeed);
  const notation = useSettingsStore((s) => s.notation);

  const visibleWhite = useKeyboardStore((s) => s.visibleWhite);
  const windowStart = useKeyboardStore((s) => s.windowStart);
  const fullscreen = useKeyboardStore((s) => s.fullscreen);

  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Push the initial volume + instrument to the engine once on mount (engine
  // starts at unity gain / default preset; align it to the UI state).
  useEffect(() => {
    setMasterGain(volume);
    useInstrumentStore.getState().syncToEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { lowMidi, highMidi } = windowRange(visibleWhite, windowStart);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: (fullscreen ? 4 : insets.top + 6),
          paddingBottom: insets.bottom + 6,
        },
      ]}>
      {/* Fullscreen hides the system status bar so the top controls are tappable. */}
      <StatusBar hidden={fullscreen} barStyle="light-content" />
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

            <View style={styles.settingsPanel}>
              <View style={styles.sliderBlock}>
                <Text style={styles.sliderLabel}>Volume</Text>
                <View style={styles.sliderRow}>
                  <Slider value={volume} onChange={setVolume} />
                </View>
                <Text style={styles.sliderValue}>{Math.round(volume * 100)}%</Text>
              </View>
              <View style={styles.sliderBlock}>
                <Text style={styles.sliderLabel}>Speed</Text>
                <View style={styles.sliderRow}>
                  <Slider
                    value={(speed - 0.5) / 1.5}
                    onChange={(v) => setSpeed(0.5 + v * 1.5)}
                  />
                </View>
                <Text style={styles.sliderValue}>{speed.toFixed(2)}×</Text>
              </View>
            </View>

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
        <Keyboard lowMidi={lowMidi} highMidi={highMidi} notation={notation} />
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
  settingsPanel: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sliderBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sliderLabel: { color: colors.text, fontSize: 13, fontWeight: '700', width: 52 },
  dim: { color: colors.textFaint },
  sliderRow: { flex: 1, marginHorizontal: 8 },
  sliderValue: { color: colors.textDim, fontSize: 12, width: 44, textAlign: 'right' },

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
