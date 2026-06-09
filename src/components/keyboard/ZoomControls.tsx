/**
 * ZoomControls — KEY SIZE  −  / fullscreen / +  (from the reference).
 *  −  shows more (smaller) keys, +  shows fewer (bigger) keys.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeyboardStore } from '../../store/keyboardStore';
import { colors } from '../../theme/colors';

function ZoomControls() {
  const zoomIn = useKeyboardStore((s) => s.zoomIn);
  const zoomOut = useKeyboardStore((s) => s.zoomOut);
  const fullscreen = useKeyboardStore((s) => s.fullscreen);
  const toggleFullscreen = useKeyboardStore((s) => s.toggleFullscreen);

  return (
    <View style={styles.card}>
      <Text style={styles.caption}>KEY SIZE</Text>
      <View style={styles.controls}>
        <Pressable style={styles.btn} onPress={zoomOut}>
          <Text style={styles.btnText}>−</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, fullscreen && styles.btnActive]}
          onPress={toggleFullscreen}>
          <Text style={styles.btnText}>⛶</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={zoomIn}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  controls: { flexDirection: 'row', alignItems: 'center' },
  caption: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  btn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  btnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '800' },
});

export default React.memo(ZoomControls);
