/**
 * SettingsModal — advanced settings (gear icon): note labels, transpose, sustain.
 * (Buffer/latency tuning is shown as info; the engine already runs low-latency.)
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import { colors } from '../../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function SettingsModal({ visible, onClose }: Props) {
  const showLabels = useSettingsStore((s) => s.showLabels);
  const setShowLabels = useSettingsStore((s) => s.setShowLabels);
  const transpose = useSettingsStore((s) => s.transpose);
  const setTranspose = useSettingsStore((s) => s.setTranspose);
  const sustain = useSettingsStore((s) => s.sustain);
  const setSustain = useSettingsStore((s) => s.setSustain);

  const transposeLabel = transpose === 0 ? '0' : transpose > 0 ? `+${transpose}` : `${transpose}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
