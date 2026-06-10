/**
 * InstrumentSelector — compact dropdown button showing only the SELECTED
 * instrument. Tapping it opens a modal popup (styled like the settings popup)
 * listing every instrument; picking one triggers a SoundFont program change in
 * the C++ engine and closes the popup. The home page only ever shows the chosen
 * instrument, not the full list.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInstrumentStore } from '../../store/instrumentStore';
import { INSTRUMENTS, instrumentById } from '../../domain/instruments';
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
  const [open, setOpen] = useState(false);

  const current = instrumentById(selected);

  return (
    <>
      {/* Home-page button: selected instrument + dropdown chevron */}
      <Pressable style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.glyph}>{GLYPH[current.id]}</Text>
        <Text style={styles.buttonLabel}>{current.label}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Instrument</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {/* 3-column card grid; scrolls within the sheet so it stays usable
                however many instruments there are (and on short screens). */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.grid}>
              {INSTRUMENTS.map((inst) => {
                const active = inst.id === selected;
                return (
                  <Pressable
                    key={inst.id}
                    style={[styles.card, active && styles.cardActive]}
                    onPress={() => {
                      setInstrument(inst.id);
                      setOpen(false);
                    }}>
                    {active && <Text style={styles.check}>✓</Text>}
                    <Text style={styles.cardGlyph}>{GLYPH[inst.id]}</Text>
                    <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>
                      {inst.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // --- home-page button ---
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  glyph: { fontSize: 15, marginRight: 7 },
  buttonLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chevron: { color: colors.textDim, fontSize: 12, fontWeight: '800', marginLeft: 8 },

  // --- modal popup ---
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '66%',
    maxHeight: '92%',
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
    marginBottom: 8,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  // 4 per row (width ~23% leaves room for three gaps); square-ish cards.
  card: {
    width: '23%',
    aspectRatio: 1,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cardGlyph: { fontSize: 30 },
  cardLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  cardLabelActive: { color: '#1a0a18' },
  check: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: '#1a0a18',
    fontSize: 14,
    fontWeight: '900',
  },
});

export default React.memo(InstrumentSelector);
