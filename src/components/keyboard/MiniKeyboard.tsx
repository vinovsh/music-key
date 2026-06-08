/**
 * MiniKeyboard — overview strip showing the whole range with a movable window.
 * Tap or drag to move which octaves the main keyboard shows (tap-to-jump).
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import {
  FULL_WHITE_KEYS,
  TOTAL_WHITE,
  useKeyboardStore,
} from '../../store/keyboardStore';
import { isC } from '../../domain/notes';
import { colors } from '../../theme/colors';

function MiniKeyboard() {
  const visibleWhite = useKeyboardStore((s) => s.visibleWhite);
  const windowStart = useKeyboardStore((s) => s.windowStart);

  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  }, []);

  // Stable handler: read the latest state from the store so we don't recreate
  // the PanResponder on every zoom change.
  const moveTo = useCallback((e: GestureResponderEvent) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const { visibleWhite: vw, setWindowStart } = useKeyboardStore.getState();
    const frac = e.nativeEvent.locationX / w;
    setWindowStart(frac * TOTAL_WHITE - vw / 2); // centre window on the touch
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: moveTo,
      onPanResponderMove: moveTo,
    }),
  ).current;

  const tickW = width > 0 ? width / TOTAL_WHITE : 0;
  const windowLeft = windowStart * tickW;
  const windowWidth = visibleWhite * tickW;

  return (
    <View style={styles.container} onLayout={onLayout} {...responder.panHandlers}>
      {/* tiny key ticks */}
      <View style={styles.ticks} pointerEvents="none">
        {FULL_WHITE_KEYS.map((midi) => (
          <View
            key={midi}
            style={[styles.tick, isC(midi) && styles.tickC]}
          />
        ))}
      </View>
      {/* current window highlight */}
      {width > 0 && (
        <View
          pointerEvents="none"
          style={[styles.window, { left: windowLeft, width: windowWidth }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    borderRadius: 7,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ticks: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  tick: {
    flex: 1,
    height: 16,
    marginHorizontal: 0.5,
    borderRadius: 1,
    backgroundColor: '#2c2750',
  },
  tickC: { backgroundColor: colors.accentDim },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,79,216,0.22)',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 6,
  },
});

export default React.memo(MiniKeyboard);
