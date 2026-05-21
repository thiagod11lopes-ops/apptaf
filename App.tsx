import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { PhoneFrameShell } from './src/components/premium/PhoneFrameShell';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';

function AppRoot() {
  const { isDark, theme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    html.style.height = '100%';
    body.style.height = '100%';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    if (root) {
      root.style.height = '100%';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
    }
    body.style.backgroundColor = isDark ? '#09090B' : '#E4E4E7';
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <View style={[styles.appRoot, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PhoneFrameShell>
        <AppNavigator />
      </PhoneFrameShell>
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.ghRoot}>
        <SafeAreaProvider style={styles.ghRoot}>
          <ThemeProvider>
            <AppRoot />
          </ThemeProvider>
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
    backgroundColor: '#000000',
  },
  appRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
