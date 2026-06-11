/**
 * SongControl — "MUSIC CONTROL": a song picker dropdown + Play/Stop button.
 * The dropdown lists the built-in songs AND songs the user has uploaded (.mid),
 * plus an "Upload MIDI" action. Uploaded songs can be deleted. Auto-play (with
 * key highlighting) works the same for built-in and uploaded songs.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlaybackStore } from '../../store/playbackStore';
import { useUserSongsStore } from '../../store/userSongsStore';
import { SONGS } from '../../domain/songs';
import { importMidiSong, songImportAvailable } from '../../services/songImport';
import { colors } from '../../theme/colors';

function SongControl() {
  const selectedId = usePlaybackStore((s) => s.selectedId);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setSong = usePlaybackStore((s) => s.setSong);
  const toggle = usePlaybackStore((s) => s.toggle);
  const userSongs = useUserSongsStore((s) => s.songs);
  const addSong = useUserSongsStore((s) => s.addSong);
  const removeSong = useUserSongsStore((s) => s.removeSong);

  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const allSongs = [...SONGS, ...userSongs];
  const song = allSongs.find((s) => s.id === selectedId) ?? SONGS[0];
  const userIds = new Set(userSongs.map((s) => s.id));

  const handleUpload = async () => {
    if (importing) return;
    if (!songImportAvailable) {
      Alert.alert(
        'Rebuild required',
        'MIDI upload needs a fresh app build. Close the app and run a full rebuild (npx react-native run-android), then try again.',
      );
      return;
    }
    setImporting(true);
    try {
      const imported = await importMidiSong();
      if (imported) {
        addSong(imported);
        setSong(imported.id);
        setOpen(false);
      }
    } catch (e: any) {
      Alert.alert('Could not import', e?.message ?? 'That file is not a valid MIDI file.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (id: string) => {
    removeSong(id);
    if (id === selectedId) setSong(SONGS[0].id); // fall back to a built-in song
  };

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
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allSongs.map((s) => {
                const active = s.id === selectedId;
                const isUser = userIds.has(s.id);
                return (
                  <View key={s.id} style={[styles.item, active && styles.itemActive]}>
                    <Pressable
                      style={styles.itemMain}
                      onPress={() => {
                        setSong(s.id);
                        setOpen(false);
                      }}>
                      <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </Pressable>
                    {isUser && (
                      <Pressable hitSlop={8} onPress={() => handleDelete(s.id)}>
                        <Text style={styles.delete}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Pressable style={styles.uploadBtn} onPress={handleUpload} disabled={importing}>
              {importing ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.uploadText}>⬆  Upload MIDI</Text>
              )}
            </Pressable>
          </Pressable>
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
    minWidth: 220,
    maxHeight: 320,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  itemMain: { flex: 1 },
  itemActive: { backgroundColor: colors.accentDim },
  itemText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  itemTextActive: { color: colors.text, fontWeight: '800' },
  delete: { color: colors.textFaint, fontSize: 14, fontWeight: '800', marginLeft: 10, paddingHorizontal: 4 },
  uploadBtn: {
    marginTop: 4,
    marginHorizontal: 8,
    marginBottom: 4,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.keyboardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});

export default React.memo(SongControl);
