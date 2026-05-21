import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { buildPremiumDarkTheme, buildPremiumLightTheme } from '../../theme/premium';

type Props = {
  children: React.ReactNode;
};

export function PhoneFrameShell({ children }: Props) {
  const { usePhoneFrame, isWeb } = useDeviceLayout();
  const { isDark } = useTheme();
  const bg = isDark ? buildPremiumDarkTheme().background : buildPremiumLightTheme().background;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.backgroundColor = isDark ? '#09090B' : '#E4E4E7';
  }, [isDark, isWeb]);

  if (!usePhoneFrame) {
    return (
      <View style={[styles.fill, { backgroundColor: bg }]} className="select-none-touch">
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.desktopOuter]} className="select-none-touch">
      <View style={styles.phoneFrame}>
        <View style={styles.dynamicIsland} />
        <View style={[styles.phoneScreen, { backgroundColor: bg }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  desktopOuter: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090B',
    padding: 24,
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 400,
    height: '85%',
    maxHeight: 900,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#27272A',
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
      } as object,
      default: {
        elevation: 24,
      },
    }),
  },
  dynamicIsland: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 120,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    zIndex: 10,
  },
  phoneScreen: {
    flex: 1,
    paddingTop: 44,
    overflow: 'hidden',
  },
});
