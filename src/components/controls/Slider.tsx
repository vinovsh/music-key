/**
 * Slider — minimal horizontal slider built on PanResponder (no native dep).
 * Value is normalised 0..1. Used for the Volume control; Speed reuses it later.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void;
  disabled?: boolean;
}

function Slider({ value, onChange, disabled }: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  }, []);

  const emit = useCallback(
    (e: GestureResponderEvent) => {
      const w = widthRef.current;
      if (w <= 0) return;
      const x = e.nativeEvent.locationX;
      onChange(Math.max(0, Math.min(1, x / w)));
    },
    [onChange],
  );

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: emit,
      onPanResponderMove: emit,
    }),
  ).current;

  const pct = Math.max(0, Math.min(1, value));

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      onLayout={onLayout}
      {...responder.panHandlers}>
      <View style={styles.baseLine} />
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      <View style={[styles.thumb, { left: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 28,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  baseLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.panelBorder,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});

// Render the empty track behind via a wrapper border so the unfilled part shows.
export default React.memo(Slider);
