/**
 * RecordKeysControls — the "RECORD KEYS" rec/play cluster from the reference.
 * REC toggles event recording (with a live timer); Play replays the latest take.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRecordingStore } from '../../store/recordingStore';
import { formatDuration } from '../../domain/recording';
import { playRecording, stopPlayback } from '../../audio/recordingPlayer';
import { colors } from '../../theme/colors';

function RecordKeysControls() {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const recordings = useRecordingStore((s) => s.recordings);
  const startRecording = useRecordingStore((s) => s.startRecording);
  const stopRecording = useRecordingStore((s) => s.stopRecording);

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [isRecording, startedAt]);

  const onRec = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (playing) {
        stopPlayback();
        setPlaying(false);
      }
      startRecording();
    }
  };

  const onPlay = () => {
    if (playing) {
      stopPlayback();
      setPlaying(false);
      return;
    }
    const latest = recordings[0];
    if (!latest) return;
    setPlaying(true);
    playRecording(latest, () => setPlaying(false));
  };

  const canPlay = recordings.length > 0 && !isRecording;

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>RECORD KEYS</Text>

      <Pressable onPress={onRec} style={[styles.btn, isRecording && styles.recActive]}>
        <View style={[styles.recDot, isRecording && styles.recDotActive]} />
      </Pressable>

      <Pressable
        onPress={onPlay}
        disabled={!canPlay}
        style={[styles.btn, !canPlay && styles.btnDisabled, playing && styles.playActive]}>
        <Text style={styles.playGlyph}>{playing ? '■' : '▶'}</Text>
      </Pressable>

      {isRecording && <Text style={styles.timer}>{formatDuration(elapsed)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  caption: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginRight: 8,
  },
  btn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  btnDisabled: { opacity: 0.4 },
  recActive: { borderColor: '#ff3b6b' },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b6b',
  },
  recDotActive: { backgroundColor: '#ff7aa0' },
  playActive: { borderColor: colors.accent },
  playGlyph: { color: colors.text, fontSize: 13, fontWeight: '800' },
  timer: {
    color: '#ff7aa0',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    width: 36,
  },
});

export default React.memo(RecordKeysControls);
