/**
 * SliderValueLabel — shows a Slider's value and updates it LIVE during a drag.
 *
 * It reads the slider's shared position on the UI thread via useAnimatedProps
 * and writes the formatted text straight into a read-only TextInput's native
 * `text` prop. So the number tracks the thumb in real time with zero React
 * re-renders per frame — the same UI-thread path that keeps the thumb smooth.
 */
import React from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  progress: SharedValue<number>; // 0..1
  format: (v: number) => string; // worklet: maps progress → display text
  style?: StyleProp<TextStyle>;
}

function SliderValueLabel({ progress, format, style }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const t = format(progress.value);
    return { text: t, defaultValue: t } as object;
  });
  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      value={format(progress.value)}
      style={style}
      animatedProps={animatedProps}
    />
  );
}

export default React.memo(SliderValueLabel);
