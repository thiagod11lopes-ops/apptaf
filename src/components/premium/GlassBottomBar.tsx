import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  ClipboardList,
  PlayCircle,
  BarChart3,
  Settings,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';
import { navigateTab } from '../../navigation/navigationRef';
import { PressableScale } from './PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

type TabId = 'Home' | 'Cadastro' | 'AplicarTAF' | 'Estatisticas' | 'Configuracoes';

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'Home', label: 'Início', icon: Home },
  { id: 'Cadastro', label: 'Cadastro', icon: ClipboardList },
  { id: 'AplicarTAF', label: 'Aplicar', icon: PlayCircle },
  { id: 'Estatisticas', label: 'Stats', icon: BarChart3 },
  { id: 'Configuracoes', label: 'Ajustes', icon: Settings },
];

const HIDDEN_ROUTES: (keyof RootStackParamList)[] = ['CadastrarResultados'];

type Props = {
  activeRoute: keyof RootStackParamList;
};

export function GlassBottomBar({ activeRoute }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  if (HIDDEN_ROUTES.includes(activeRoute)) {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 12);
  const barBg = isDark ? 'rgba(24, 24, 27, 0.94)' : 'rgba(255, 255, 255, 0.94)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: bottomPad,
          backgroundColor: barBg,
          borderColor,
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as object)
          : undefined,
      ]}
      pointerEvents="box-none"
    >
      {TABS.map((tab) => {
        const active = activeRoute === tab.id;
        const isCenter = tab.id === 'AplicarTAF';
        const Icon = tab.icon;
        const color = active ? theme.primary : theme.textMuted;

        if (isCenter) {
          return (
            <PressableScale
              key={tab.id}
              onPress={() => navigateTab(tab.id)}
              style={styles.centerTab}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.centerBtn, { backgroundColor: theme.primary }]}>
                <Icon size={26} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Text style={[styles.centerLabel, { color: theme.primary }]}>{tab.label}</Text>
            </PressableScale>
          );
        }

        return (
          <PressableScale
            key={tab.id}
            onPress={() => navigateTab(tab.id)}
            style={styles.tab}
            accessibilityLabel={tab.label}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.5 : 2} />
            <Text style={[styles.tabLabel, { color: active ? theme.primary : theme.textMuted }]}>
              {tab.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    zIndex: 100,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } as object,
      default: { elevation: 12 },
    }),
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: { fontSize: 10, marginTop: 4, fontWeight: '600' },
  centerTab: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: { fontSize: 10, marginTop: 4, fontWeight: '700' },
});
