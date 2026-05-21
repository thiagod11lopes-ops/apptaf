import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  children: React.ReactNode;
};

/**
 * Mobile/PWA: 100% da tela.
 * Desktop web: frame de smartphone ultra-moderno centralizado.
 */
export function PhoneFrameShell({ children }: Props) {
  const { usePhoneFrame, isWeb } = useDeviceLayout();
  const { isDark } = useTheme();

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
      <View className="flex-1 w-full h-full min-h-full bg-white dark:bg-black select-none-touch">
        {children}
      </View>
    );
  }

  return (
    <View className="flex-1 min-h-screen w-full items-center justify-center bg-zinc-200 dark:bg-zinc-950 p-6 md:p-10 select-none-touch">
      <View
        className="relative w-full max-w-[400px] h-[85vh] max-h-[900px] rounded-[40px] border-4 border-zinc-800 ring-1 ring-zinc-700 shadow-2xl overflow-hidden bg-black"
        style={{ aspectRatio: 9 / 19.5 }}
      >
        {/* Dynamic Island */}
        <View
          className="absolute top-3 left-0 right-0 z-50 items-center pointer-events-none"
          accessibilityElementsHidden
        >
          <View className="w-[120px] h-[28px] rounded-full bg-black border border-white/5 shadow-lg" />
        </View>

        {/* Área do app */}
        <View className="flex-1 w-full h-full pt-10 overflow-hidden bg-white dark:bg-black">
          {children}
        </View>
      </View>
    </View>
  );
}
