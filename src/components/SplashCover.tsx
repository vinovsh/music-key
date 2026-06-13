/**
 * SplashCover — an opaque, on-theme overlay shown over the app at launch until
 * the persisted stores have hydrated. The real UI mounts and lays out (keyboard
 * measures its width, stores load saved values) BENEATH this cover, so when it
 * fades out the screen is already fully formed — no flash of default state or a
 * zero-width keyboard. Matches colors.bg so it reads as an intentional splash.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

function SplashCover({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(1);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 240 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.cover, style]}>
      <Text style={styles.icon}>🎹</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  icon: { fontSize: 56, opacity: 0.9 },
});

export default React.memo(SplashCover);
