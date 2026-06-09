/**
 * Keyboard — multi-touch piano with glissando, matching ref/piano_ui.png.
 *
 * LATENCY (CLAUDE.md §1): touch handlers call noteOn/noteOff DIRECTLY (synchronous
 * JSI into C++). The visual "glow" uses React state and is allowed to lag a frame.
 *
 * SCROLLING: the full white-key range (C2–C7) is rendered once at a fixed key
 * width (= viewport / visibleWhite) and translated horizontally by a shared
 * value (`scrollIndex`), so the mini-keyboard can slide it smoothly on the UI
 * thread. The touch overlay stays fixed over the viewport; hit-testing simply
 * adds the current scroll offset, so input stays trivial and rock-solid.
 *
 * Input model: a single transparent overlay claims the responder and we reconcile
 * the full live touch list every event. This gives us, uniformly:
 *   - chords (multiple simultaneous pointers, each its own note),
 *   - glissando (a pointer moving onto a new key → noteOff(old) + noteOn(new)),
 *   - clean release of individual fingers.
 * Notes are ref-counted so two fingers on one key don't cut each other off.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { playNoteOff, playNoteOn } from '../../audio/performer';
import { usePlaybackStore } from '../../store/playbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  FULL_WHITE_KEYS,
  TOTAL_WHITE,
  useKeyboardStore,
} from '../../store/keyboardStore';
import { scrollIndex } from '../../store/keyboardScroll';
import { colors } from '../../theme/colors';
import { isC, noteLabel, type Notation } from '../../domain/notes';

const BLACK_WIDTH_RATIO = 0.62; // black key width relative to a white key
const BLACK_HEIGHT_RATIO = 0.62; // black key height relative to keyboard height

interface BlackKeyGeom {
  midi: number;
  left: number;
  width: number;
}

interface Props {
  notation: Notation;
}

function Keyboard({ notation }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  // Notes lit by song auto-play (separate from touch-driven glow).
  const playbackActive = usePlaybackStore((s) => s.active);
  const transpose = useSettingsStore((s) => s.transpose);
  const showLabels = useSettingsStore((s) => s.showLabels);
  const visibleWhite = useKeyboardStore((s) => s.visibleWhite);

  // pointer id -> { visual key (for glow), sounding pitch (for the engine) }
  const pointerMap = useRef<Map<number, { visual: number; sound: number }>>(new Map());
  // sounding pitch -> how many fingers are holding it (ref-counted note on/off)
  const noteCounts = useRef<Map<number, number>>(new Map());

  // Fixed key width so `visibleWhite` keys fill the viewport; the full row is
  // wider than the viewport and gets translated to scroll.
  const keyWidth = size.width > 0 && visibleWhite > 0 ? size.width / visibleWhite : 0;
  const rowWidth = keyWidth * TOTAL_WHITE;
  const blackHeight = size.height * BLACK_HEIGHT_RATIO;

  // Geometry for black keys across the FULL range (absolute row coordinates).
  const blackKeys = useMemo<BlackKeyGeom[]>(() => {
    if (keyWidth <= 0) return [];
    const out: BlackKeyGeom[] = [];
    const width = keyWidth * BLACK_WIDTH_RATIO;
    for (let i = 0; i < FULL_WHITE_KEYS.length - 1; i++) {
      const w = FULL_WHITE_KEYS[i];
      const next = FULL_WHITE_KEYS[i + 1];
      // A black key exists between two white keys only when they're 2 semitones
      // apart (e.g. C->D has C#; E->F are adjacent, no black key).
      if (next - w === 2) {
        const boundary = (i + 1) * keyWidth;
        out.push({ midi: w + 1, left: boundary - width / 2, width });
      }
    }
    return out;
  }, [keyWidth]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  // Slide the key row by the live scroll offset (UI thread).
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollIndex.value * keyWidth }],
  }));

  // --- hit testing -----------------------------------------------------------
  // The overlay is fixed over the viewport, so add the current scroll offset to
  // map a viewport touch to an absolute key in the full row.
  const midiAt = useCallback(
    (x: number, y: number): number | null => {
      if (keyWidth <= 0) return null;
      const absX = x + scrollIndex.value * keyWidth;
      if (y <= blackHeight) {
        for (const b of blackKeys) {
          if (absX >= b.left && absX < b.left + b.width) return b.midi;
        }
      }
      let idx = Math.floor(absX / keyWidth);
      if (idx < 0) idx = 0;
      if (idx >= FULL_WHITE_KEYS.length) idx = FULL_WHITE_KEYS.length - 1;
      return FULL_WHITE_KEYS[idx];
    },
    [keyWidth, blackHeight, blackKeys],
  );

  // --- ref-counted sound (the actual JSI calls) ------------------------------
  // Engine notes are ref-counted by the SOUNDING pitch (visual key + transpose),
  // so chords + transpose can't cut each other off. Glow uses the VISUAL key.
  const press = useCallback((sound: number, velocity: number) => {
    const counts = noteCounts.current;
    const c = counts.get(sound) ?? 0;
    if (c === 0) playNoteOn(sound, velocity); // synchronous JSI -> C++ (+capture)
    counts.set(sound, c + 1);
  }, []);

  const release = useCallback((sound: number) => {
    const counts = noteCounts.current;
    const c = counts.get(sound) ?? 0;
    if (c <= 1) {
      counts.delete(sound);
      playNoteOff(sound); // synchronous JSI -> C++ (+capture)
    } else {
      counts.set(sound, c - 1);
    }
  }, []);

  const refreshGlow = useCallback(() => {
    // Glow = the visual keys currently held by any pointer.
    const visuals = new Set<number>();
    for (const p of pointerMap.current.values()) visuals.add(p.visual);
    setActive(visuals);
  }, []);

  // Reconcile our pointer map against the authoritative live touch list.
  const reconcile = useCallback(
    (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.touches ?? [];
      const map = pointerMap.current;
      const seen = new Set<number>();

      for (const t of touches) {
        const id = Number(t.identifier);
        seen.add(id);
        const visual = midiAt(t.locationX, t.locationY);
        const prev = map.get(id);
        if (visual == null) {
          if (prev) {
            release(prev.sound);
            map.delete(id);
          }
          continue;
        }
        if (!prev || prev.visual !== visual) {
          if (prev) release(prev.sound);
          const sound = visual + transpose;
          const vel = 0.45 + 0.55 * clamp01(t.locationY / Math.max(1, size.height));
          press(sound, vel);
          map.set(id, { visual, sound });
        }
      }

      // Fingers that lifted since last event.
      for (const [id, p] of map) {
        if (!seen.has(id)) {
          release(p.sound);
          map.delete(id);
        }
      }

      refreshGlow();
    },
    [midiAt, press, release, refreshGlow, transpose, size.height],
  );

  const releaseAll = useCallback(() => {
    for (const p of pointerMap.current.values()) release(p.sound);
    pointerMap.current.clear();
    refreshGlow();
  }, [release, refreshGlow]);

  const lit = (midi: number) => active.has(midi) || playbackActive.has(midi);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Animated.View style={[styles.scrollRow, { width: rowWidth }, rowStyle]}>
        {/* White keys (full range) */}
        <View style={styles.whiteRow} pointerEvents="none">
          {FULL_WHITE_KEYS.map((midi) => (
            <View
              key={midi}
              style={[
                styles.whiteKey,
                { width: keyWidth },
                lit(midi) && styles.whiteKeyActive,
              ]}>
              {showLabels && keyWidth > 0 && (
                <Text
                  style={[styles.whiteLabel, isC(midi) && styles.cLabel]}
                  numberOfLines={1}>
                  {noteLabel(midi, notation)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Black keys (full range) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {blackKeys.map((b) => (
            <View
              key={b.midi}
              style={[
                styles.blackKey,
                { left: b.left, width: b.width, height: blackHeight },
                lit(b.midi) && styles.blackKeyActive,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Touch overlay: fixed over the viewport, owns all input. */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={reconcile}
        onResponderMove={reconcile}
        onResponderRelease={releaseAll}
        onResponderTerminate={releaseAll}
      />
    </View>
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.keyboardBg,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scrollRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  whiteRow: {
    flexDirection: 'row',
    height: '100%',
  },
  whiteKey: {
    height: '100%',
    backgroundColor: colors.whiteKey,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.whiteKeyShadow,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  whiteKeyActive: {
    backgroundColor: colors.whiteKeyActive,
    borderColor: colors.accent,
    borderRightWidth: 2,
    borderLeftWidth: 2,
    elevation: 6,
  },
  whiteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textFaint,
  },
  cLabel: {
    color: colors.accent,
    fontWeight: '800',
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.blackKey,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  blackKeyActive: {
    backgroundColor: colors.blackKeyActive,
    borderColor: '#ffffff',
    elevation: 8,
  },
});

export default React.memo(Keyboard);
