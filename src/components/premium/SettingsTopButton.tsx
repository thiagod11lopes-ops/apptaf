import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { navigateTab } from '../../navigation/navigationRef';
import type { RootStackParamList } from '../../navigation/types';
import { PressableScale } from './PressableScale';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { PREMIUM } from '../../theme/premium';

type Props = {
  activeRoute: keyof RootStackParamList;
};

const HIDE_ON: (keyof RootStackParamList)[] = ['Configuracoes', 'CadastrarResultados'];

export function SettingsTopButton({ activeRoute }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { useSidebarShell } = useDeviceLayout();

  if (HIDE_ON.includes(activeRoute) || useSidebarShell) {
    return null;
  }

  const tabInk = theme.isDark ? '#FFFFFF' : '#111827';
  const compacto = activeRoute === 'Home';
  const iconSize = compacto ? 11 : 22;
  const btnSize = compacto ? 24 : PREMIUM.minTouch;

  return (
    <View
      style={[styles.wrap, { top: Math.max(insets.top, 8) + 4 }]}
      pointerEvents="box-none"
    >
      <PressableScale
        onPress={() => navigateTab('Configuracoes')}
        style={[
          styles.btn,
          {
            width: btnSize,
            height: btnSize,
            backgroundColor: theme.cardBg,
            borderColor: theme.border,
          },
          Platform.OS === 'web'
            ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.1)' } as object)
            : { elevation: 8 },
        ]}
        accessibilityLabel="Ajustes"
      >
        <Settings size={iconSize} color={tabInk} strokeWidth={compacto ? 2 : 2.2} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 200,
  },
  btn: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
