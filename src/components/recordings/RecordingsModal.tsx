/**
 * RecordingsModal — the "LIST / Recordings" library.
 *
 * Two kinds (CLAUDE.md §4):
 *  - Audio (REC As Sound): .m4a files, managed natively — play/rename/delete/share.
 *  - Key takes (RECORD KEYS): event takes in the store — play/rename/delete.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRecordingStore } from '../../store/recordingStore';
import { useSoundRecorderStore } from '../../store/soundRecorderStore';
import { SoundRecorder, type SoundRecording } from '../../audio/soundRecorder';
import { formatDuration, type Recording } from '../../domain/recording';
import { playRecording, stopPlayback } from '../../audio/recordingPlayer';
import { colors } from '../../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function RecordingsModal({ visible, onClose }: Props) {
  // Key takes
  const recordings = useRecordingStore((s) => s.recordings);
  const deleteRecording = useRecordingStore((s) => s.deleteRecording);
  const renameRecording = useRecordingStore((s) => s.renameRecording);
  // Audio takes
  const audio = useSoundRecorderStore((s) => s.recordings);
  const refreshAudio = useSoundRecorderStore((s) => s.refresh);

  const [playingKeyId, setPlayingKeyId] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) refreshAudio();
  }, [visible, refreshAudio]);

  const stopAllPlayback = () => {
    stopPlayback();
    SoundRecorder.stopPlayback();
    setPlayingKeyId(null);
    setPlayingAudio(null);
  };

  const close = () => {
    stopAllPlayback();
    setEditId(null);
    onClose();
  };

  // --- key takes ---
  const toggleKey = (rec: Recording) => {
    if (playingKeyId === rec.id) {
      stopPlayback();
      setPlayingKeyId(null);
      return;
    }
    stopAllPlayback();
    setPlayingKeyId(rec.id);
    playRecording(rec, () => setPlayingKeyId(null));
  };
  const confirmDeleteKey = (rec: Recording) =>
    Alert.alert('Delete take', `Delete "${rec.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecording(rec.id) },
    ]);

  // --- audio takes ---
  const toggleAudio = (rec: SoundRecording) => {
    if (playingAudio === rec.path) {
      SoundRecorder.stopPlayback();
      setPlayingAudio(null);
      return;
    }
    stopAllPlayback();
    setPlayingAudio(rec.path);
    SoundRecorder.play(rec.path).catch(() => setPlayingAudio(null));
  };
  const confirmDeleteAudio = (rec: SoundRecording) =>
    Alert.alert('Delete recording', `Delete "${rec.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await SoundRecorder.remove(rec.path);
          refreshAudio();
        },
      },
    ]);

  const commitAudioRename = async (rec: SoundRecording) => {
    if (draft.trim()) await SoundRecorder.rename(rec.path, draft.trim());
    setEditId(null);
    refreshAudio();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Recordings</Text>
            <Pressable onPress={close} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView>
            <Text style={styles.section}>AUDIO · REC AS SOUND</Text>
            {audio.length === 0 ? (
              <Text style={styles.empty}>No audio recordings yet.</Text>
            ) : (
              audio.map((rec) => (
                <View key={rec.path} style={styles.row}>
                  <Pressable
                    onPress={() => toggleAudio(rec)}
                    style={[styles.iconBtn, playingAudio === rec.path && styles.iconBtnActive]}>
                    <Text style={styles.iconText}>{playingAudio === rec.path ? '■' : '▶'}</Text>
                  </Pressable>
                  <View style={styles.meta}>
                    {editId === rec.path ? (
                      <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        onBlur={() => commitAudioRename(rec)}
                        onSubmitEditing={() => commitAudioRename(rec)}
                        autoFocus
                        style={styles.input}
                      />
                    ) : (
                      <Text style={styles.name} numberOfLines={1}>{rec.name}</Text>
                    )}
                    <Text style={styles.sub}>{formatDuration(rec.durationMs)} · m4a</Text>
                  </View>
                  <Pressable onPress={() => { setEditId(rec.path); setDraft(rec.name); }} style={styles.iconBtn}>
                    <Text style={styles.iconText}>✎</Text>
                  </Pressable>
                  <Pressable onPress={() => SoundRecorder.share(rec.path)} style={styles.iconBtn}>
                    <Text style={styles.iconText}>⤴</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteAudio(rec)} style={styles.iconBtn}>
                    <Text style={styles.iconText}>🗑</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.section}>KEY TAKES · RECORD KEYS</Text>
            {recordings.length === 0 ? (
              <Text style={styles.empty}>No key takes yet.</Text>
            ) : (
              recordings.map((rec) => (
                <View key={rec.id} style={styles.row}>
                  <Pressable
                    onPress={() => toggleKey(rec)}
                    style={[styles.iconBtn, playingKeyId === rec.id && styles.iconBtnActive]}>
                    <Text style={styles.iconText}>{playingKeyId === rec.id ? '■' : '▶'}</Text>
                  </Pressable>
                  <View style={styles.meta}>
                    {editId === rec.id ? (
                      <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        onBlur={() => { if (draft.trim()) renameRecording(rec.id, draft.trim()); setEditId(null); }}
                        onSubmitEditing={() => { if (draft.trim()) renameRecording(rec.id, draft.trim()); setEditId(null); }}
                        autoFocus
                        style={styles.input}
                      />
                    ) : (
                      <Text style={styles.name} numberOfLines={1}>{rec.name}</Text>
                    )}
                    <Text style={styles.sub}>{formatDuration(rec.durationMs)} · {rec.events.length} events</Text>
                  </View>
                  <Pressable onPress={() => { setEditId(rec.id); setDraft(rec.name); }} style={styles.iconBtn}>
                    <Text style={styles.iconText}>✎</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteKey(rec)} style={styles.iconBtn}>
                    <Text style={styles.iconText}>🗑</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '74%',
    maxHeight: '88%',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 16,
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
  section: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  empty: { color: colors.textFaint, fontSize: 13, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  meta: { flex: 1, marginHorizontal: 10 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  input: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.keyboardBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  iconBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  iconText: { color: colors.text, fontSize: 15 },
});

export default React.memo(RecordingsModal);
