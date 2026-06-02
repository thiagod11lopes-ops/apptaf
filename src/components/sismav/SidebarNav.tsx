import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import {
  Home,
  ClipboardList,
  PlayCircle,
  BarChart3,
  ListChecks,
  Settings,
  BookOpen,
  User,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';
import { navigateTab } from '../../navigation/navigationRef';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_BRAND, FONT_BRAND_SUB } from '../../theme/typography';

const appLogo = require('../../../assets/icon.png');

type TabId = 'Home' | 'Cadastro' | 'AplicarTAF' | 'Estatisticas' | 'Resultados';

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'Home', label: 'Iniciar', icon: Home },
  { id: 'Cadastro', label: 'Cadastro', icon: ClipboardList },
  { id: 'AplicarTAF', label: 'Aplicar', icon: PlayCircle },
  { id: 'Resultados', label: 'Resultado', icon: ListChecks },
  { id: 'Estatisticas', label: 'Estatísticas', icon: BarChart3 },
];

type Props = {
  activeRoute: keyof RootStackParamList;
};

export function SidebarNav({ activeRoute }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <Image source={appLogo} style={styles.logo} resizeMode="contain" accessibilityLabel="TAF" />
        <Text style={[styles.brandTitle, { fontFamily: FONT_BRAND }]}>TAF</Text>
        <Text style={[styles.brandSub, { fontFamily: FONT_BRAND_SUB }]}>Sistema TAF</Text>
      </View>

      <View style={styles.tabsList} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = activeRoute === tab.id;
          const Icon = tab.icon;
          return (
            <PressableScale
              key={tab.id}
              onPress={() => navigateTab(tab.id)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <Icon size={18} color="#FFFFFF" strokeWidth={active ? 2.5 : 2} opacity={active ? 1 : 0.78} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.footerActions}>
        <PressableScale
          onPress={() => navigateTab('Normas')}
          style={[styles.settingsBtn, activeRoute === 'Normas' && styles.footerBtnActive]}
          accessibilityLabel="Normas"
          accessibilityState={{ selected: activeRoute === 'Normas' }}
        >
          <BookOpen size={18} color="#FFFFFF" strokeWidth={2} opacity={activeRoute === 'Normas' ? 1 : 0.85} />
          <Text style={[styles.tabLabel, activeRoute === 'Normas' && styles.tabLabelActive]}>Normas</Text>
        </PressableScale>

        <PressableScale
          onPress={() => navigateTab('AplicacaoTAF')}
          style={[styles.settingsBtn, activeRoute === 'AplicacaoTAF' && styles.footerBtnActive]}
          accessibilityLabel="Registrador de TAF"
          accessibilityState={{ selected: activeRoute === 'AplicacaoTAF' }}
        >
          <ClipboardList size={18} color="#FFFFFF" strokeWidth={2} opacity={activeRoute === 'AplicacaoTAF' ? 1 : 0.85} />
          <Text style={[styles.tabLabel, activeRoute === 'AplicacaoTAF' && styles.tabLabelActive]}>
            Registrador
          </Text>
        </PressableScale>

        <PressableScale
          onPress={() => navigateTab('Login')}
          style={[styles.settingsBtn, activeRoute === 'Login' && styles.footerBtnActive]}
          accessibilityLabel="Conta"
          accessibilityState={{ selected: activeRoute === 'Login' }}
        >
          <User size={18} color="#FFFFFF" strokeWidth={2} opacity={activeRoute === 'Login' ? 1 : 0.85} />
          <Text style={[styles.tabLabel, activeRoute === 'Login' && styles.tabLabelActive]}>Conta</Text>
        </PressableScale>

        <PressableScale
          onPress={() => navigateTab('Configuracoes')}
          style={styles.settingsBtn}
          accessibilityLabel="Configurações"
        >
          <Settings size={18} color="#FFFFFF" strokeWidth={2} opacity={0.85} />
          <Text style={styles.tabLabel}>Ajustes</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.52)',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginTop: 4,
  },
  tabsList: {
    flex: 1,
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.28)',
    ...({
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    } as object),
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  footerActions: {
    gap: 4,
    marginTop: 8,
  },
  footerBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
