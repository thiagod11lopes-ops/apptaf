import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: React.ReactNode;
  className?: string;
};

/** Escala 0.98 ao pressionar — microinteração premium (300ms ease-out) */
export function PressableScale({ children, className, style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      className={className}
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        scale.value = withTiming(0.98, { duration: 150 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 300 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
