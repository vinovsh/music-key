/**
 * AdBanner — bottom banner slot (matches the mock). Placeholder for now;
 * structured so a real AdMob banner (react-native-google-mobile-ads) can drop in
 * here later without touching the screen layout.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

function AdBanner() {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.megaphone}>📣</Text>
        <View>
          <Text style={styles.title}>Your Ad Banner</Text>
          <Text style={styles.sub}>This is a great place for your advertisement</Text>
        </View>
      </View>
      <Pressable style={styles.cta}>
        <Text style={styles.ctaText}>LEARN MORE</Text>
      </Pressable>
      <Text style={styles.badge}>Ad</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  megaphone: { fontSize: 20, marginRight: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  sub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginRight: 10,
  },
  ctaText: { color: '#1a0a18', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  badge: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
});

export default React.memo(AdBanner);
