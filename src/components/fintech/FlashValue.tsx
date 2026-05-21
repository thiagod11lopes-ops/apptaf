import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MonoValue } from './MonoValue';
import { useTheme } from '../../contexts/ThemeContext';
import { FINTECH } from '../../theme/fintech';

type Variant = 'default' | 'gain' | 'loss';

type Props = {
  value: string | number;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Dispara flash quando o valor muda */
  flashKey?: string | number;
};

export function FlashValue({ value, variant = 'default', size = 'md', flashKey }: Props) {
  const { theme } = useTheme();
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withSequence(
      withTiming(1, { duration: FINTECH.durationFast }),
      withTiming(0, { duration: FINTECH.durationNormal }),
    );
  }, [flashKey ?? value, glow]);

  const glowColor =
    variant === 'gain' ? theme.gain : variant === 'loss' ? theme.loss : theme.primary;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1,
    shadowOpacity: glow.value * 0.6,
    ...(variant !== 'default' && {
      textShadowRadius: 8 * glow.value,
    }),
  }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle, { shadowColor: glowColor }]}>
      <MonoValue variant={variant} size={size}>
        {value}
      </MonoValue>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 0,
  },
});
