/**
 * InstrumentSelector — Piano / Flute / Organ / Guitar, matching the reference.
 * Selecting one triggers a SoundFont program change in the C++ engine.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useInstrumentStore } from '../../store/instrumentStore';
import { INSTRUMENTS } from '../../domain/instruments';
import { colors } from '../../theme/colors';

// Simple glyphs stand in for icons (no icon dependency in Phase 2).
const GLYPH: Record<string, string> = {
  piano: '🎹',
  flute: '🎵',
  organ: '🎛',
  guitar: '🎸',
};

function InstrumentSelector() {
  const selected = useInstrumentStore((s) => s.selected);
  const setInstrument = useInstrumentStore((s) => s.setInstrument);

  return (
    <View style={styles.row}>
      {INSTRUMENTS.map((inst) => {
        const active = inst.id === selected;
        return (
          <Pressable
            key={inst.id}
            onPress={() => setInstrument(inst.id)}
            style={[styles.item, active && styles.itemActive]}>
            <Text style={styles.glyph}>{GLYPH[inst.id]}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>
              {inst.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    marginHorizontal: 2,
  },
  itemActive: {
    backgroundColor: colors.accent,
  },
  glyph: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: '#1a0a18',
  },
});

export default React.memo(InstrumentSelector);
