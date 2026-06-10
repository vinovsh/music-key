/**
 * AdBanner — top banner slot (matches the mock). Placeholder for now; structured
 * so a real AdMob banner (react-native-google-mobile-ads) can drop in later
 * WITHOUT touching the screen layout.
 *
 * IMPORTANT (don't hide the buttons): this is a FIXED-HEIGHT slot that lives in
 * the normal flex-column flow — never absolutely positioned. So it reserves its
 * own space and pushes the toolbar/keyboard down instead of overlapping them.
 * BANNER_HEIGHT matches a standard 320×50 AdMob banner; when you swap in the real
 * <BannerAd/>, render it inside this same slot so the layout never shifts and the
 * buttons below always stay visible.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

// Standard AdMob banner height (320×50). Keep the slot at least this tall so a
// real banner fits exactly in the placeholder's footprint.
export const BANNER_HEIGHT = 50;

function AdBanner() {
  return (
    <View style={styles.slot}>
      {/* Replace the contents below with the real <BannerAd/> — the slot height
          stays fixed, so nothing else on screen moves or gets covered. */}
      <View style={styles.wrap}>
        <View style={styles.left}>
          <Text style={styles.megaphone}>📣</Text>
          <View>
            <Text style={styles.title}>Your Ad Banner</Text>
            <Text style={styles.sub} numberOfLines={1}>
              This is a great place for your advertisement
            </Text>
          </View>
        </View>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>LEARN MORE</Text>
        </Pressable>
        <Text style={styles.badge}>Ad</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed-height reserved slot in normal flow — guarantees the ad never overlaps
  // or hides the toolbar/keyboard below it.
  slot: {
    minHeight: BANNER_HEIGHT,
    justifyContent: 'center',
    marginBottom: 8,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
