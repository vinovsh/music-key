/**
 * SettingsModal — advanced settings (gear icon): note labels, transpose, sustain.
 * (Buffer/latency tuning is shown as info; the engine already runs low-latency.)
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Slider from '../controls/Slider';
import SliderValueLabel from '../controls/SliderValueLabel';
import { RING_MAX, RING_MIN, useSettingsStore } from '../../store/settingsStore';
import { setMasterGain } from '../../audio/audio';
import { colors } from '../../theme/colors';

const RING_SPAN = RING_MAX - RING_MIN;

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Worklets: map a 0..1 slider position to the displayed text (run on the UI thread).
function fmtVolume(v: number) {
  'worklet';
  return `${Math.round(v * 100)}%`;
}
function fmtSpeed(v: number) {
  'worklet';
  return `${(0.5 + v * 1.5).toFixed(2)}×`; // speed slider is normalised 0..1
}
function fmtRing(v: number) {
  'worklet';
  return `${(0.25 + v * 2.75).toFixed(1)}s`; // RING_MIN 0.25 .. RING_MAX 3.0
}

function SettingsModal({ visible, onClose }: Props) {
  const volume = useSettingsStore((s) => s.volume);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const speed = useSettingsStore((s) => s.speed);
  const setSpeed = useSettingsStore((s) => s.setSpeed);

  // Shared 0..1 positions, bound to BOTH the slider thumb and its live label.
  const volProgress = useSharedValue(volume);
  const speedProgress = useSharedValue((speed - 0.5) / 1.5);
  const showLabels = useSettingsStore((s) => s.showLabels);
  const setShowLabels = useSettingsStore((s) => s.setShowLabels);
  const transpose = useSettingsStore((s) => s.transpose);
  const setTranspose = useSettingsStore((s) => s.setTranspose);
  const sustain = useSettingsStore((s) => s.sustain);
  const setSustain = useSettingsStore((s) => s.setSustain);
  const ringSec = useSettingsStore((s) => s.ringSec);
  const setRingSec = useSettingsStore((s) => s.setRingSec);

  const ringProgress = useSharedValue((ringSec - RING_MIN) / RING_SPAN);

  const transposeLabel = transpose === 0 ? '0' : transpose > 0 ? `+${transpose}` : `${transpose}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* RN Modal is its own Android window, outside the app-root gesture provider,
          so the in-modal sliders need their own root to receive gestures. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Volume</Text>
            {/* Live gain each move; persist once on release (smooth — see Slider). */}
            <View style={styles.sliderTrack}>
              <Slider
                value={volume}
                progress={volProgress}
                onChange={setMasterGain}
                onCommit={setVolume}
              />
            </View>
            <SliderValueLabel
              progress={volProgress}
              format={fmtVolume}
              style={styles.sliderValue}
            />
          </View>

          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Speed</Text>
            <View style={styles.sliderTrack}>
              <Slider
                value={(speed - 0.5) / 1.5}
                progress={speedProgress}
                onCommit={(v) => setSpeed(0.5 + v * 1.5)}
              />
            </View>
            <SliderValueLabel
              progress={speedProgress}
              format={fmtSpeed}
              style={styles.sliderValue}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Show note labels</Text>
            <Switch
              value={showLabels}
              onValueChange={setShowLabels}
              trackColor={{ true: colors.accent, false: colors.panelBorder }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Sustain</Text>
            <Switch
              value={sustain}
              onValueChange={setSustain}
              trackColor={{ true: colors.accent, false: colors.panelBorder }}
              thumbColor={colors.text}
            />
          </View>

          {/* How long a released note rings out (only applies when Sustain is on). */}
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, !sustain && styles.labelDim]}>
              Ring time
            </Text>
            <View style={styles.sliderTrack}>
              <Slider
                value={(ringSec - RING_MIN) / RING_SPAN}
                progress={ringProgress}
                onCommit={(v) => setRingSec(RING_MIN + v * RING_SPAN)}
                disabled={!sustain}
              />
            </View>
            <SliderValueLabel
              progress={ringProgress}
              format={fmtRing}
              style={[styles.sliderValue, !sustain && styles.labelDim]}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Transpose</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setTranspose(transpose - 1)}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{transposeLabel}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setTranspose(transpose + 1)}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.note}>
            Audio runs in low-latency mode (Oboe, exclusive stream). Tap-to-sound goes
            through JSI synchronously.
          </Text>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '60%',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.keyboardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  sliderLabel: { color: colors.text, fontSize: 15, fontWeight: '600', width: 64 },
  labelDim: { opacity: 0.4 },
  sliderTrack: { flex: 1, marginHorizontal: 12 },
  sliderValue: {
    color: colors.textDim,
    fontSize: 13,
    width: 52,
    textAlign: 'right',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 34,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  stepValue: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    width: 44,
    textAlign: 'center',
  },
  note: { color: colors.textFaint, fontSize: 11, marginTop: 14, lineHeight: 16 },
});

export default React.memo(SettingsModal);
