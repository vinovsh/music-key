/**
 * NotationToggle — "SHOW NOTES: C / Do" from the reference.
 * Switches key labels between Western (C D E…) and solfège (Do Re Mi…).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import { colors } from '../../theme/colors';
import type { Notation } from '../../domain/notes';

const OPTIONS: { value: Notation; label: string }[] = [
  { value: 'western', label: 'C' },
  { value: 'solfege', label: 'Do' },
];

function NotationToggle() {
  const notation = useSettingsStore((s) => s.notation);
  const setNotation = useSettingsStore((s) => s.setNotation);

  return (
    <View style={styles.card}>
      <Text style={styles.caption}>SHOW NOTES</Text>
      <View style={styles.group}>
        {OPTIONS.map((o) => {
          const active = o.value === notation;
          return (
            <Pressable
              key={o.value}
              onPress={() => setNotation(o.value)}
              style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
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
  caption: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 1,
  },
  group: {
    flexDirection: 'row',
    backgroundColor: colors.keyboardBg,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 3,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 7,
  },
  pillActive: { backgroundColor: colors.accent },
  pillText: { color: colors.textDim, fontSize: 13, fontWeight: '800' },
  pillTextActive: { color: '#1a0a18' },
});

export default React.memo(NotationToggle);
