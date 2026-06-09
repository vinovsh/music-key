/**
 * Slider — horizontal slider on the UI thread (Reanimated + Gesture Handler).
 * Value is normalised 0..1. Used for the Volume + Speed controls.
 *
 * PERFORMANCE: the gesture runs entirely as worklets on the UI thread. The thumb
 * position is a shared value, and the thumb/fill styles read it via
 * useAnimatedStyle — so dragging never touches the JS thread or the React
 * reconciler (no setState, no re-render, no bridge round-trip per move). This is
 * what keeps it fluid on low-end devices. We only cross back to JS to apply the
 * live effect (onChange, e.g. engine gain) and to persist once on release
 * (onCommit), both via runOnJS — neither blocks the visual.
 */
import React, { useCallback, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface Props {
  value: number; // 0..1
  // Optional external position (0..1). Share it with a label to show the value
  // live during a drag without any React re-render. Defaults to an internal one.
  progress?: SharedValue<number>;
  onChange?: (v: number) => void; // continuous, while dragging (cheap)
  onCommit?: (v: number) => void; // on release; defaults to onChange
  disabled?: boolean;
}

function clamp01(v: number) {
  'worklet';
  return Math.max(0, Math.min(1, v));
}

function Slider({ value, progress, onChange, onCommit, disabled }: Props) {
  const internalPos = useSharedValue(value);
  const pos = progress ?? internalPos; // 0..1 thumb position (shared if provided)
  const width = useSharedValue(0); // track width in px
  const active = useSharedValue(false); // true while dragging

  // Reflect external value changes (store/rehydrate) — but never fight the drag.
  useEffect(() => {
    if (!active.value) pos.value = value;
  }, [value, pos, active]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
    },
    [width],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0) // react to the very first touch, like a real slider
    .onBegin((e) => {
      'worklet';
      active.value = true;
      const v = clamp01(width.value > 0 ? e.x / width.value : 0);
      pos.value = v;
      if (onChange) runOnJS(onChange)(v);
    })
    .onUpdate((e) => {
      'worklet';
      const v = clamp01(width.value > 0 ? e.x / width.value : 0);
      pos.value = v;
      if (onChange) runOnJS(onChange)(v);
    })
    .onFinalize(() => {
      'worklet';
      active.value = false;
      const cb = onCommit ?? onChange;
      if (cb) runOnJS(cb)(pos.value);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * width.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: pos.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.track, disabled && styles.disabled]}
        onLayout={onLayout}>
        <View style={styles.baseLine} />
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
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
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    transformOrigin: 'left center', // scaleX grows from the left edge
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8, // center the thumb on its position
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});

export default React.memo(Slider);
