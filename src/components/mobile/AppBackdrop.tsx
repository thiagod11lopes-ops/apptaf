import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { getMobileAppBackdrop } from './mobileAppTheme';
import { LogombWatermark } from './LogombWatermark';
import { IS_WEB } from '../../utils/webVisualPerf';

/** Gradiente suave + Logomb — na web: cor sólida (sem gradient/watermark). */
export function AppBackdrop() {
  const { theme } = useTheme();
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  }, []);

  // Web: um fill sólido — evita LinearGradient + PNG gigante em toda navegação.
  if (IS_WEB) {
    const solid = theme.isDark ? '#0b1224' : '#eef2ff';
    return <View style={[styles.root, { backgroundColor: solid }]} pointerEvents="none" />;
  }

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <LinearGradient
        colors={[...getMobileAppBackdrop(theme)]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
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
});
