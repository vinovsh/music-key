/**
 * SongControl — "MUSIC CONTROL" from the reference: a song picker dropdown and
 * a Play/Stop button that auto-plays the selected song (with key highlighting).
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaybackStore } from '../../store/playbackStore';
import { SONGS, songById } from '../../domain/songs';
import { colors } from '../../theme/colors';

function SongControl() {
  const selectedId = usePlaybackStore((s) => s.selectedId);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setSong = usePlaybackStore((s) => s.setSong);
  const toggle = usePlaybackStore((s) => s.toggle);
  const [open, setOpen] = useState(false);

  const song = songById(selectedId);

  return (
    <View style={styles.row}>
      <Pressable style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Pressable style={[styles.play, isPlaying && styles.playActive]} onPress={toggle}>
        <Text style={styles.playGlyph}>{isPlaying ? '■' : '▶'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {SONGS.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.item, s.id === selectedId && styles.itemActive]}
                onPress={() => {
                  setSong(s.id);
                  setOpen(false);
                }}>
                <Text style={[styles.itemText, s.id === selectedId && styles.itemTextActive]}>
                  {s.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 130,
    justifyContent: 'space-between',
  },
  songTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginRight: 8 },
  caret: { color: colors.textDim, fontSize: 12 },
  play: {
    width: 40,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  playActive: { backgroundColor: '#ff3b6b' },
  playGlyph: { color: '#1a0a18', fontSize: 15, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'flex-end', paddingTop: 70, paddingRight: 16 },
  sheet: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: 6,
    minWidth: 200,
  },
  item: { paddingHorizontal: 16, paddingVertical: 11 },
  itemActive: { backgroundColor: colors.accentDim },
  itemText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  itemTextActive: { color: colors.text, fontWeight: '800' },
});

export default React.memo(SongControl);
