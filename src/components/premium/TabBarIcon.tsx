import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LucideIcon } from 'lucide-react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const IONICON_FALLBACK: Record<string, IoniconsName> = {
  Home: 'home',
  Cadastro: 'clipboard-outline',
  AplicarTAF: 'play-circle',
  Resultados: 'list',
  Estatisticas: 'bar-chart-outline',
};

type Props = {
  tabId: string;
  LucideIcon: LucideIcon;
  size: number;
  color: string;
  strokeWidth?: number;
};

/** No web desktop (frame estreito), Ionicons evita ícones SVG que somem ou deixam vazar texto da tela. */
export function TabBarIcon({ tabId, LucideIcon: Icon, size, color, strokeWidth = 2 }: Props) {
  const { usePhoneFrame } = useDeviceLayout();
  const useIonicon = Platform.OS === 'web' && usePhoneFrame;
  const ionName = IONICON_FALLBACK[tabId];

  return (
    <View style={[styles.slot, { width: size + 4, height: size + 4 }]}>
      {useIonicon && ionName ? (
        <Ionicons name={ionName} size={size} color={color} />
      ) : (
        <Icon size={size} color={color} strokeWidth={strokeWidth} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
