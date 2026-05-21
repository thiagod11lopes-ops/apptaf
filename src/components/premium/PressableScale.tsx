import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
  className?: string;
};

export function PressableScale({ children, className, style, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      className={className}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
