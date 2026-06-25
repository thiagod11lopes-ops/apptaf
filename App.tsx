import './global.css';
import React, { useEffect } from 'react';
import { View, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { OfflineSyncProvider } from './src/contexts/OfflineSyncContext';
import { DataStoreProvider } from './src/offline-first/store/DataStoreContext';
import { getCachedDataOwnerUid } from './src/services/firebase/authUid';
import { PhoneFrameShell } from './src/components/premium/PhoneFrameShell';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { AdminHistoricoApp } from './src/admin/AdminHistoricoApp';
import { isAdminHistoricoAccess } from './src/utils/adminHistoricoAccess';
import { useAppFonts } from './src/hooks/useAppFonts';
import { PREMIUM } from './src/theme/premium';

function AppRoot() {
  const { isDark, theme, themeMode } = useTheme();
  const adminHistorico = Platform.OS === 'web' && isAdminHistoricoAccess();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    html.style.height = '100%';
    body.style.height = '100%';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    body.style.fontFamily = '"Segoe UI", Inter, system-ui, sans-serif';
    html.setAttribute('data-theme', themeMode);
    if (root) {
      root.style.height = '100%';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
    }
    if ('serviceWorker' in navigator) {
      const base =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/apptaf')
          ? '/apptaf'
          : '';
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => undefined);
    }
    body.style.backgroundColor = theme.tokens.bg;
    html.classList.toggle('dark', isDark);
  }, [isDark, themeMode, theme.tokens.bg]);

  if (adminHistorico) {
    return (
      <View style={[styles.appRoot, { backgroundColor: theme.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AdminHistoricoApp />
      </View>
    );
  }

  return (
    <View style={[styles.appRoot, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PhoneFrameShell>
        <AppNavigator />
      </PhoneFrameShell>
    </View>
  );
}

function AppWithDataStore({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const ownerUid = isAuthenticated ? getCachedDataOwnerUid() : null;
  return <DataStoreProvider ownerUid={ownerUid}>{children}</DataStoreProvider>;
}

function AppWithTheme() {
  const { fontsLoaded, fontError } = useAppFonts();
  const ready = fontsLoaded || (Platform.OS === 'web' && !!fontError);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={PREMIUM.accentLight} />
      </View>
    );
  }

  return (
    <ThemeProvider fontsLoaded={fontsLoaded && !fontError}>
      <AuthProvider>
        <AppWithDataStore>
          <OfflineSyncProvider>
            <AppRoot />
          </OfflineSyncProvider>
        </AppWithDataStore>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.ghRoot}>
        <SafeAreaProvider style={styles.ghRoot}>
          <AppWithTheme />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  ghRoot: {
    flex: 1,
    width: '100%',
    height: Platform.OS === 'web' ? ('100vh' as unknown as number) : '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    backgroundColor: PREMIUM.dark.bg,
  },
  appRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PREMIUM.dark.bg,
  },
});
