import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { TopActionIcons } from './TopActionIcons';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

type Props = {
  activeRoute: keyof RootStackParamList;
};

const HIDE_ON: (keyof RootStackParamList)[] = [
  'Home',
  'Cadastro',
  'AplicarTAF',
  'Resultados',
  'Estatisticas',
  'Configuracoes',
  'CadastrarResultados',
  'Login',
];

export function SettingsTopButton({ activeRoute }: Props) {
  const insets = useSafeAreaInsets();
  const { useSidebarShell, hideSidebarForLandscape } = useDeviceLayout();
  const imersivoTaf = activeRoute === 'AplicarTAF' && hideSidebarForLandscape;

  if (HIDE_ON.includes(activeRoute) || useSidebarShell || imersivoTaf) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { top: Math.max(insets.top, 8) + 4 }]}
      pointerEvents="box-none"
    >
      <TopActionIcons activeRoute={activeRoute} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 200,
    alignItems: 'flex-end',
  },
});
