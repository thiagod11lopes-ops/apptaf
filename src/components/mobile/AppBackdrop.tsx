import React, { useCallback, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { getMobileAppBackdrop, mobileAppShared } from './mobileAppTheme';
import { LogombWatermark } from './LogombWatermark';

/** Gradiente, orbes e Logomb — fundo global de todo o sistema. */
export function AppBackdrop() {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  }, []);

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <LinearGradient
        colors={[...getMobileAppBackdrop(theme)]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
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
      {layout.width > 0 && layout.height > 0 ? (
        <LogombWatermark
          containerWidth={layout.width}
          containerHeight={layout.height}
          sizeMultiplier={2}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
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
