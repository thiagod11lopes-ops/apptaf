import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';

type Props = {
  children: React.ReactNode;
};

export function PhoneFrameShell({ children }: Props) {
  const { usePhoneFrame, isWeb } = useDeviceLayout();
  const { isDark, theme } = useTheme();

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    document.body.style.backgroundColor = theme.tokens.bg;
  }, [isDark, isWeb, theme.tokens.bg]);

  if (!usePhoneFrame) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>{children}</View>
    );
  }

  return (
    <View style={styles.desktopOuter}>
      <View style={styles.phoneFrame}>
        <View style={styles.dynamicIsland} />
        <View style={[styles.phoneScreen, { backgroundColor: theme.background }]}>{children}</View>
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
    backgroundColor: '#14141A',
    padding: 24,
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 400,
    height: '85%',
    maxHeight: 900,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#3F3F4A',
    overflow: 'hidden',
    backgroundColor: PREMIUM.dark.bg,
    ...Platform.select({
      web: { boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)' } as object,
      default: { elevation: 24 },
    }),
  },
  dynamicIsland: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 112,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#14141A',
    zIndex: 10,
  },
  phoneScreen: {
    flex: 1,
    paddingTop: 44,
    overflow: 'hidden',
  },
});
