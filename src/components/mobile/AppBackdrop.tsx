import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { getMobileAppBackdrop, mobileAppShared } from './mobileAppTheme';
import { LogombWatermark } from './LogombWatermark';

/** Gradiente, orbes e Logomb — fundo global de todo o sistema. */
export function AppBackdrop() {
  const { theme } = useTheme();
  const isDark = theme.isDark;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...getMobileAppBackdrop(theme)]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LogombWatermark sizeMultiplier={2} />
      <View
        style={[
          mobileAppShared.orbLarge,
          styles.orbTop,
          { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : 'rgba(37,99,235,0.1)' },
        ]}
      />
      <View
        style={[
          mobileAppShared.orb,
          styles.orbMid,
          { backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)' },
        ]}
      />
      <View
        style={[
          mobileAppShared.orbLarge,
          styles.orbBottom,
          { backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.07)' },
        ]}
      />
      <LinearGradient
        colors={
          isDark
            ? ['transparent', 'rgba(56,189,248,0.04)', 'transparent']
            : ['transparent', 'rgba(37,99,235,0.05)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gridSheen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orbTop: {
    top: -120,
    right: -100,
  },
  orbMid: {
    top: '38%',
    left: -70,
  },
  orbBottom: {
    bottom: -140,
    right: -80,
  },
  gridSheen: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
});
