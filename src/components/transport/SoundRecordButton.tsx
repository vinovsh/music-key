/**
 * SoundRecordButton — the big red "REC / As Sound" button from the reference.
 * Records the actual audio output to an .m4a file, with a live timer.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSoundRecorderStore } from '../../store/soundRecorderStore';
import { formatDuration } from '../../domain/recording';
import { colors } from '../../theme/colors';

function SoundRecordButton() {
  const isRecording = useSoundRecorderStore((s) => s.isRecording);
  const startedAt = useSoundRecorderStore((s) => s.startedAt);
  const start = useSoundRecorderStore((s) => s.start);
  const stop = useSoundRecorderStore((s) => s.stop);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [isRecording, startedAt]);

  return (
    <Pressable
      onPress={() => (isRecording ? stop() : start())}
      style={[styles.wrap, isRecording && styles.recording]}>
      <View style={styles.dot} />
      <View>
        <Text style={styles.rec}>{isRecording ? 'STOP' : 'REC'}</Text>
        <Text style={styles.sub}>{isRecording ? formatDuration(elapsed) : 'As Sound'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recording: { borderColor: '#ff3b6b', backgroundColor: '#2a1320' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b6b',
    marginRight: 8,
  },
  rec: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  sub: { color: colors.textFaint, fontSize: 10, fontWeight: '700', width: 56 },
});

export default React.memo(SoundRecordButton);
