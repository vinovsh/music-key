/**
 * Keyboard — multi-touch piano with glissando, matching ref/piano_ui.png.
 *
 * LATENCY (CLAUDE.md §1): touch handlers call noteOn/noteOff DIRECTLY (synchronous
 * JSI into C++). The visual "glow" uses React state and is allowed to lag a frame.
 *
 * LOOK: each key is a 3D-shaded stack of Views (top sheen + body + bottom front
 * lip/bevel) and presses with a snappy "click" — the key face dips down and an
 * accent glow blooms in (Reanimated, UI thread). All of this is purely visual and
 * never gates the sound (CLAUDE.md §1). Keys are memoized so a single press only
 * re-renders the pressed key, not the whole row (CLAUDE.md §6).
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { playNoteOff, playNoteOn } from '../../audio/performer';
import { usePlaybackStore } from '../../store/playbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  FULL_WHITE_KEYS,
  TOTAL_WHITE,
  useKeyboardStore,
} from '../../store/keyboardStore';
import { scrollIndex } from '../../store/keyboardScroll';
import { useLiveNotesStore } from '../../store/liveNotesStore';
import { colors } from '../../theme/colors';
import { clamp as clampN } from '../../theme/responsive';
import { isC, noteLabel, type Notation } from '../../domain/notes';

const BLACK_WIDTH_RATIO = 0.62; // black key width relative to a white key
const BLACK_HEIGHT_RATIO = 0.62; // black key height relative to keyboard height

const WHITE_PRESS_DEPTH = 5; // px the white key face dips when pressed
const BLACK_PRESS_DEPTH = 4; // px the black key face dips when pressed

interface BlackKeyGeom {
  midi: number;
  left: number;
  width: number;
}

interface Props {
  notation: Notation;
}

/**
 * Drives a 0→1 "pressed" shared value with a crisp click: fast on the way down,
 * slightly softer on release. Runs on the UI thread (Reanimated).
 */
function usePressProgress(pressed: boolean) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(pressed ? 1 : 0, { duration: pressed ? 30 : 110 });
  }, [pressed, p]);
  return p;
}

// --- White key (ivory, 3D) ---------------------------------------------------
interface WhiteKeyProps {
  width: number;
  pressed: boolean;
  showLabel: boolean;
  label: string;
  isCKey: boolean;
}

const WhiteKey = React.memo(function WhiteKey({
  width,
  pressed,
  showLabel,
  label,
  isCKey,
}: WhiteKeyProps) {
  const p = usePressProgress(pressed);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: p.value * WHITE_PRESS_DEPTH }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    // lip recedes as the key sinks
    bottom: interpolate(p.value, [0, 1], [0, -2]),
  }));
  return (
    <View style={[styles.whiteKey, { width }]}>
      <Animated.View style={[styles.whiteFace, faceStyle]}>
        <View style={styles.whiteSheen} />
        <View style={styles.whiteLip} />
        <Animated.View style={[styles.whiteGlow, glowStyle]} pointerEvents="none" />
        {showLabel && (
          <Text
            style={[
              styles.whiteLabel,
              { fontSize: clampN(width * 0.26, 9, 20) }, // scale with key width
              isCKey && styles.cLabel,
            ]}
            numberOfLines={1}>
            {label}
          </Text>
        )}
      </Animated.View>
    </View>
  );
});

// --- Black key (ebony, 3D) ---------------------------------------------------
interface BlackKeyProps {
  left: number;
  width: number;
  height: number;
  pressed: boolean;
}

const BlackKey = React.memo(function BlackKey({
  left,
  width,
  height,
  pressed,
}: BlackKeyProps) {
  const p = usePressProgress(pressed);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: p.value * BLACK_PRESS_DEPTH }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={[styles.blackKey, { left, width, height }]}>
      <Animated.View style={[styles.blackFace, faceStyle]}>
        <View style={styles.blackSheen} />
        <View style={styles.blackFront} />
        <Animated.View style={[styles.blackGlow, glowStyle]} pointerEvents="none" />
      </Animated.View>
    </View>
  );
});

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
  // Mirror of the `active` glow set, read synchronously by refreshGlow to skip
  // no-op state updates (setActive is async, so we can't read `active` directly).
  const activeRef = useRef<ReadonlySet<number>>(active);

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
    // Skip the state update (and the 88-key re-render it triggers) when the lit
    // set is unchanged. onResponderMove fires ~60-120×/s while a finger stays on
    // the same key; without this guard every one of those events re-rendered the
    // keyboard, backing up the JS thread → input lag + late noteOn/noteOff. We
    // compare against the live `active` set via a ref so this stays a stable cb.
    const prev = activeRef.current;
    if (prev.size === visuals.size) {
      let same = true;
      for (const m of visuals) if (!prev.has(m)) { same = false; break; }
      if (same) return;
    }
    activeRef.current = visuals;
    setActive(visuals);
    // Publish to the mini-keyboard overview so it can highlight where you press.
    useLiveNotesStore.getState().setActive(visuals);
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
            <WhiteKey
              key={midi}
              width={keyWidth}
              pressed={lit(midi)}
              showLabel={showLabels && keyWidth > 0}
              label={noteLabel(midi, notation)}
              isCKey={isC(midi)}
            />
          ))}
        </View>

        {/* Black keys (full range) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {blackKeys.map((b) => (
            <BlackKey
              key={b.midi}
              left={b.left}
              width={b.width}
              height={blackHeight}
              pressed={lit(b.midi)}
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

  // --- White key ----------------------------------------------------------
  // Slot is the dark recess the key sits in; the face dips into it on press.
  whiteKey: {
    height: '100%',
    backgroundColor: colors.keyboardBg,
    // Dark recess between adjacent white keys — reads as a real gap/shadow, not
    // a pale line. Uses the keyboard-well colour so the keys look seated in it.
    borderRightWidth: 2,
    borderColor: colors.keyboardBg,
  },
  whiteFace: {
    flex: 1,
    backgroundColor: colors.whiteKey,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    // soft drop shadow gives the key its raised feel
    elevation: 4,
    overflow: 'hidden',
  },
  // top sheen: a subtle light band across the upper portion (ivory gloss)
  whiteSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: '#ffffff',
    // Low opacity so the band's bottom edge doesn't read as a hard line across
    // every key (we can't feather without a gradient lib / extra views). Keeps a
    // faint top gloss; the key is already near-white so this is enough.
    opacity: 0.18,
  },
  // bottom front lip: a slightly darker rounded strip = the front face of the key
  whiteLip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 9,
    backgroundColor: colors.whiteKeyShadow,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    // Softer than before so the lip's top edge no longer reads as a hard gray
    // line across the keys, while still giving the front-face depth cue.
    opacity: 0.35,
  },
  // accent bloom shown while held
  whiteGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.whiteKeyActive,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
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

  // --- Black key ----------------------------------------------------------
  blackKey: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#000',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    overflow: 'hidden',
  },
  blackFace: {
    flex: 1,
    backgroundColor: colors.blackKey,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderWidth: 1,
    borderColor: '#000',
    elevation: 7,
    overflow: 'hidden',
  },
  // glossy highlight near the top of the ebony key
  blackSheen: {
    position: 'absolute',
    top: 0,
    left: '14%',
    right: '14%',
    height: '34%',
    backgroundColor: '#5a5470',
    opacity: 0.5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  // raised front face at the bottom (the bevel that catches the light)
  blackFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#34303f',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  blackGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.blackKeyActive,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
});

export default React.memo(Keyboard);
