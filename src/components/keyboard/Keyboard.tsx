/**
 * Keyboard — multi-touch piano with glissando, matching ref/piano_ui.png.
 *
 * LATENCY (CLAUDE.md §1): touch handlers call noteOn/noteOff DIRECTLY (synchronous
 * JSI into C++). The visual "glow" uses React state and is allowed to lag a frame.
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
import { playNoteOff, playNoteOn } from '../../audio/performer';
import { usePlaybackStore } from '../../store/playbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { colors } from '../../theme/colors';
import {
  isC,
  noteLabel,
  whiteKeysInRange,
  type Notation,
} from '../../domain/notes';

const BLACK_WIDTH_RATIO = 0.62; // black key width relative to a white key
const BLACK_HEIGHT_RATIO = 0.62; // black key height relative to keyboard height

interface BlackKeyGeom {
  midi: number;
  left: number;
  width: number;
}

interface Props {
  lowMidi: number;
  highMidi: number;
  notation: Notation;
}

function Keyboard({ lowMidi, highMidi, notation }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  // Notes lit by song auto-play (separate from touch-driven glow).
  const playbackActive = usePlaybackStore((s) => s.active);
  const transpose = useSettingsStore((s) => s.transpose);
  const showLabels = useSettingsStore((s) => s.showLabels);

  // pointer id -> { visual key (for glow), sounding pitch (for the engine) }
  const pointerMap = useRef<Map<number, { visual: number; sound: number }>>(new Map());
  // sounding pitch -> how many fingers are holding it (ref-counted note on/off)
  const noteCounts = useRef<Map<number, number>>(new Map());

  const whiteKeys = useMemo(
    () => whiteKeysInRange(lowMidi, highMidi),
    [lowMidi, highMidi],
  );

  const whiteWidth = size.width > 0 ? size.width / whiteKeys.length : 0;
  const blackHeight = size.height * BLACK_HEIGHT_RATIO;

  // Geometry for black keys: centred on the boundary above their left white key.
  const blackKeys = useMemo<BlackKeyGeom[]>(() => {
    if (whiteWidth <= 0) return [];
    const out: BlackKeyGeom[] = [];
    const width = whiteWidth * BLACK_WIDTH_RATIO;
    for (let i = 0; i < whiteKeys.length - 1; i++) {
      const w = whiteKeys[i];
      const next = whiteKeys[i + 1];
      // A black key exists between two white keys only when they're 2 semitones
      // apart (e.g. C->D has C#; E->F are adjacent, no black key).
      if (next - w === 2) {
        const boundary = (i + 1) * whiteWidth;
        out.push({ midi: w + 1, left: boundary - width / 2, width });
      }
    }
    return out;
  }, [whiteKeys, whiteWidth]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  // --- hit testing -----------------------------------------------------------
  const midiAt = useCallback(
    (x: number, y: number): number | null => {
      if (whiteWidth <= 0) return null;
      if (y <= blackHeight) {
        for (const b of blackKeys) {
          if (x >= b.left && x < b.left + b.width) return b.midi;
        }
      }
      let idx = Math.floor(x / whiteWidth);
      if (idx < 0) idx = 0;
      if (idx >= whiteKeys.length) idx = whiteKeys.length - 1;
      return whiteKeys[idx];
    },
    [whiteWidth, blackHeight, blackKeys, whiteKeys],
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
      {/* White keys */}
      <View style={styles.whiteRow} pointerEvents="none">
        {whiteKeys.map((midi) => (
          <View
            key={midi}
            style={[styles.whiteKey, lit(midi) && styles.whiteKeyActive]}>
            {showLabels && (
              <Text
                style={[styles.whiteLabel, isC(midi) && styles.cLabel]}
                numberOfLines={1}>
                {noteLabel(midi, notation)}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Black keys */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {blackKeys.map((b) => (
          <View
            key={b.midi}
            style={[
              styles.blackKey,
              {
                left: b.left,
                width: b.width,
                height: blackHeight,
              },
              lit(b.midi) && styles.blackKeyActive,
            ]}
          />
        ))}
      </View>

      {/* Touch overlay: owns all input, sits above the (non-interactive) keys. */}
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
    flexDirection: 'row',
    backgroundColor: colors.keyboardBg,
    borderRadius: 10,
    overflow: 'hidden',
  },
  whiteRow: {
    flex: 1,
    flexDirection: 'row',
  },
  whiteKey: {
    flex: 1,
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
