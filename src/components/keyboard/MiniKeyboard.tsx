/**
 * MiniKeyboard — overview strip showing the whole range with a movable window.
 * Tap or drag to move which octaves the main keyboard shows (tap-to-jump).
 *
 * PERFORMANCE: the gesture is a UI-thread worklet (Gesture Handler + Reanimated)
 * that writes the SHARED scroll position (`scrollIndex`). Both this highlight box
 * and the main keyboard read that shared value, so the window and the keys slide
 * together on the UI thread with zero React re-renders. We only cross to JS
 * (runOnJS) to push the integer window into the store — which bails on no-op
 * steps — and on release we animate-snap to a whole key.
 */
import React, { useCallback, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  FULL_WHITE_KEYS,
  TOTAL_WHITE,
  useKeyboardStore,
} from '../../store/keyboardStore';
import { scrollActive, scrollIndex } from '../../store/keyboardScroll';
import { useLiveNotesStore } from '../../store/liveNotesStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { isC } from '../../domain/notes';
import { colors } from '../../theme/colors';

const BLACK_WIDTH_RATIO = 0.62; // black key width relative to a white key
const BLACK_W_PCT = (BLACK_WIDTH_RATIO / TOTAL_WHITE) * 100; // of strip width

// Mini black-key positions as percentages of the strip width (centred on the
// boundary between two white keys, just like the main keyboard).
const MINI_BLACKS: { midi: number; leftPct: number }[] = (() => {
  const out: { midi: number; leftPct: number }[] = [];
  for (let i = 0; i < FULL_WHITE_KEYS.length - 1; i++) {
    if (FULL_WHITE_KEYS[i + 1] - FULL_WHITE_KEYS[i] === 2) {
      const boundaryPct = ((i + 1) / TOTAL_WHITE) * 100;
      out.push({ midi: FULL_WHITE_KEYS[i] + 1, leftPct: boundaryPct - BLACK_W_PCT / 2 });
    }
  }
  return out;
})();

// midi -> position on the strip, so the live-press overlay can place a marker
// over the exact key (white = full height, black = upper 62%, like the keys).
const WHITE_PCT = 100 / TOTAL_WHITE; // one white key's share of the strip width
const WHITE_FILL = 0.6; // marker covers 60% of the key, centred (slim indicator)
const KEY_POS: Record<number, { leftPct: number; widthPct: number; black: boolean }> = (() => {
  const m: Record<number, { leftPct: number; widthPct: number; black: boolean }> = {};
  FULL_WHITE_KEYS.forEach((midi, i) => {
    m[midi] = {
      leftPct: i * WHITE_PCT + (WHITE_PCT * (1 - WHITE_FILL)) / 2, // centre the bar
      widthPct: WHITE_PCT * WHITE_FILL,
      black: false,
    };
  });
  for (const b of MINI_BLACKS) {
    m[b.midi] = { leftPct: b.leftPct, widthPct: BLACK_W_PCT, black: true };
  }
  return m;
})();

/**
 * Overlay that lights up the keys currently held on the main keyboard. Subscribes
 * to the live-notes store on its own so MiniKeyboard's gesture parent never
 * re-renders on a keypress (which would recreate the pan gesture every note).
 */
const MiniPressHighlight = React.memo(function MiniPressHighlight() {
  const touch = useLiveNotesStore((s) => s.active); // your live key presses
  const auto = usePlaybackStore((s) => s.active); // song / recording auto-play
  if (touch.size === 0 && auto.size === 0) return null;
  const active = touch.size === 0 ? auto : auto.size === 0 ? touch : new Set([...touch, ...auto]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[...active].map((midi) => {
        const p = KEY_POS[midi];
        if (!p) return null;
        return (
          <View
            key={midi}
            style={[
              styles.press,
              { left: `${p.leftPct}%`, width: `${p.widthPct}%`, height: p.black ? '62%' : '100%' },
            ]}
          />
        );
      })}
    </View>
  );
});

// Touch x → leftmost-white-key index of the window, centred on the finger.
function startFromTouch(x: number, w: number, visible: number): number {
  'worklet';
  const frac = w > 0 ? x / w : 0;
  const s = frac * TOTAL_WHITE - visible / 2;
  const maxStart = Math.max(0, TOTAL_WHITE - visible);
  return Math.max(0, Math.min(maxStart, s));
}

function MiniKeyboard() {
  const visibleWhite = useKeyboardStore((s) => s.visibleWhite);

  const width = useSharedValue(0); // strip width in px
  const vw = useSharedValue(visibleWhite); // window size, for worklet maths

  useEffect(() => {
    vw.value = visibleWhite;
  }, [visibleWhite, vw]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
    },
    [width],
  );

  const applyStart = useCallback((i: number) => {
    useKeyboardStore.getState().setWindowStart(i);
  }, []);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      scrollActive.value = true;
      const s = startFromTouch(e.x, width.value, vw.value);
      scrollIndex.value = s;
      runOnJS(applyStart)(s);
    })
    .onUpdate((e) => {
      'worklet';
      const s = startFromTouch(e.x, width.value, vw.value);
      scrollIndex.value = s;
      runOnJS(applyStart)(s);
    })
    .onFinalize(() => {
      'worklet';
      // Snap to a whole key so the keyboard rests cleanly aligned.
      const maxStart = Math.max(0, TOTAL_WHITE - vw.value);
      const target = Math.max(0, Math.min(maxStart, Math.round(scrollIndex.value)));
      runOnJS(applyStart)(target);
      scrollIndex.value = withTiming(target, { duration: 110 }, () => {
        scrollActive.value = false;
      });
    });

  const windowStyle = useAnimatedStyle(() => {
    const tickW = width.value / TOTAL_WHITE;
    return {
      transform: [{ translateX: scrollIndex.value * tickW }],
      width: vw.value * tickW,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container} onLayout={onLayout}>
        {/* mini piano: white keys + black keys, matching the main keyboard */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.whiteRow}>
            {FULL_WHITE_KEYS.map((midi) => (
              <View
                key={midi}
                style={[styles.whiteKey, isC(midi) && styles.whiteKeyC]}
              />
            ))}
          </View>
          {MINI_BLACKS.map((b) => (
            <View
              key={b.midi}
              style={[
                styles.blackKey,
                { left: `${b.leftPct}%`, width: `${BLACK_W_PCT}%` },
              ]}
            />
          ))}
        </View>
        {/* live press highlights (mirrors the keys you're holding) */}
        <MiniPressHighlight />
        {/* current window highlight (driven on the UI thread) */}
        <Animated.View pointerEvents="none" style={[styles.window, windowStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    borderRadius: 7,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    overflow: 'hidden',
  },
  whiteRow: {
    flexDirection: 'row',
    height: '100%',
  },
  whiteKey: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.whiteKey,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.whiteKeyShadow,
  },
  // a subtle accent tag at the bottom of each C, for orientation
  whiteKeyC: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accentDim,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    height: '62%',
    backgroundColor: colors.blackKey,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#000',
  },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,79,216,0.22)',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 6,
  },
  // marker shown over a key on the strip while it's pressed on the main keyboard
  press: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.accent,
    borderRadius: 1.5,
  },
});

export default React.memo(MiniKeyboard);
