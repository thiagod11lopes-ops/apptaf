import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { SidebarNav } from './SidebarNav';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  children: React.ReactNode;
  activeRoute: keyof RootStackParamList;
  fullWidth?: boolean;
};

export function AppShell({ children, activeRoute, fullWidth }: Props) {
  const { theme } = useTheme();
  const { useSidebarShell } = useDeviceLayout();
  const t = theme.tokens;

  if (!useSidebarShell) {
    return <>{children}</>;
  }

  return (
    <View
      style={styles.app}
      accessibilityRole="none"
      {...(Platform.OS === 'web' ? { className: 'app' as never } : {})}
    >
      <LinearGradient
        colors={[...t.gradientSidebar]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sidebar}
        {...(Platform.OS === 'web' ? { className: 'app-sidebar' as never } : {})}
      >
        <SidebarNav activeRoute={activeRoute} />
      </LinearGradient>
      <View style={styles.body} {...(Platform.OS === 'web' ? { className: 'app-body' as never } : {})}>
        <LinearGradient
          colors={[...t.gradientAppBg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.main, fullWidth && styles.mainFull]}
          {...(Platform.OS === 'web'
            ? { className: `app-main${fullWidth ? ' app-main--full' : ''}` as never }
            : {})}
        >
          {children}
        </LinearGradient>
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Sistema TAF · {new Date().getFullYear()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  sidebar: {
    width: 188,
    flexShrink: 0,
    ...Platform.select({
      web: { boxShadow: '4px 0 24px rgba(15, 23, 42, 0.18)' } as object,
      default: { elevation: 8 },
    }),
  },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    padding: 24,
  },
  mainFull: {
    maxWidth: undefined,
    alignSelf: 'stretch',
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
