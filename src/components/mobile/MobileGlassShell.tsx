import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  children: React.ReactNode;
};

/** Contêiner flexível — o fundo global fica em AppBackdrop (AppNavigator). */
export function MobileGlassShell({ children }: Props) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
});
