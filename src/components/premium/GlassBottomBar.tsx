import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  ClipboardList,
  PlayCircle,
  BarChart3,
  ListChecks,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';
import { navigateTab } from '../../navigation/navigationRef';
import { PressableScale } from './PressableScale';
import { TabBarIcon } from './TabBarIcon';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { fontFamily } from '../../theme/typography';

type TabId = 'Home' | 'Cadastro' | 'AplicarTAF' | 'Estatisticas' | 'Resultados';

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'Home', label: 'Iniciar', icon: Home },
  { id: 'Cadastro', label: 'Cadastro', icon: ClipboardList },
  { id: 'AplicarTAF', label: 'Aplicar', icon: PlayCircle },
  { id: 'Resultados', label: 'Resultado', icon: ListChecks },
  { id: 'Estatisticas', label: 'Estatísticas', icon: BarChart3 },
];

const HIDDEN_ROUTES: (keyof RootStackParamList)[] = ['CadastrarResultados', 'Configuracoes'];

type Props = {
  activeRoute: keyof RootStackParamList;
};

export function GlassBottomBar({ activeRoute }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, fontsLoaded } = useTheme();
  const { usePhoneFrame } = useDeviceLayout();
  const labelStyle = usePhoneFrame ? styles.tabLabelCompact : styles.tabLabel;

  if (HIDDEN_ROUTES.includes(activeRoute)) {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 12);
  const labelFont = fontFamily('medium', fontsLoaded);
  const tabInk = theme.isDark ? '#FFFFFF' : '#111827';
  const activeBorder = theme.primary;

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: bottomPad,
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          paddingHorizontal: usePhoneFrame ? 6 : 10,
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: theme.isDark
                ? '0 8px 32px rgba(0,0,0,0.45)'
                : '0 8px 28px rgba(15,23,42,0.12)',
              zIndex: 1000,
              isolation: 'isolate',
            } as object)
          : { elevation: 24 },
      ]}
      pointerEvents="box-none"
    >
      {TABS.map((tab) => {
        const active = activeRoute === tab.id;
        const Icon = tab.icon;

        return (
          <PressableScale
            key={tab.id}
            onPress={() => navigateTab(tab.id)}
            style={[
              styles.tab,
              usePhoneFrame && styles.tabCompact,
              active && styles.tabActive,
              active && { borderColor: activeBorder, backgroundColor: theme.accentMuted },
            ]}
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <TabBarIcon
              tabId={tab.id}
              LucideIcon={Icon}
              size={22}
              color={tabInk}
              strokeWidth={active ? 2.5 : 2}
            />
            <Text
              style={[
                labelStyle,
                {
                  color: tabInk,
                  fontFamily: labelFont,
                  fontWeight: active ? '700' : '500',
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: PREMIUM.radiusXl,
    borderWidth: 1,
    zIndex: 1000,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: PREMIUM.radiusMd,
  },
  tabActive: {
    borderWidth: 2,
  },
  tabLabel: { fontSize: 11, marginTop: 4, textAlign: 'center', maxWidth: '100%' },
  tabLabelCompact: { fontSize: 9, marginTop: 3, textAlign: 'center', maxWidth: '100%', letterSpacing: -0.2 },
  tabCompact: { paddingHorizontal: 2, minWidth: 0 },
});
