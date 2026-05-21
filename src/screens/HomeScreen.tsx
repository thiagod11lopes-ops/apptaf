import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';
import { Card } from '../components/Card';
import { PressableScale } from '../components/premium/PressableScale';
import { BookOpen, ClipboardList, Users, ChevronRight } from 'lucide-react-native';
import { PREMIUM } from '../theme/premium';

const appLogo = require('../../assets/icon.png');

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const navigation = useNavigation<Nav>();
  useFocusEffect(useCallback(() => {}, []));

  const goTo = useCallback(
    (screen: keyof RootStackParamList) => {
      navigation.navigate(screen as never);
    },
    [navigation],
  );

  const quickLinks = [
    {
      id: 'normas',
      title: 'Normas',
      subtitle: 'CGCFN-108 · Planilha de Consulta',
      Icon: BookOpen,
      onPress: () => goTo('Normas'),
    },
    {
      id: 'registro',
      title: 'Registrador de TAF',
      subtitle: 'Histórico e filtros',
      Icon: ClipboardList,
      onPress: () => goTo('AplicacaoTAF'),
    },
    {
      id: 'cadastro',
      title: 'Cadastro',
      subtitle: 'Participantes e planilha',
      Icon: Users,
      onPress: () => goTo('Cadastro'),
    },
  ];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: theme.accentMuted }]}>
          <Image source={appLogo} style={styles.badgeLogo} resizeMode="contain" accessibilityLabel="TAF" />
          <Text style={[ts.label, styles.badgeLabel, { color: '#FFFFFF' }]}>
            Sistema TAF
          </Text>
        </View>
        <Text style={[ts.hero, styles.heroTitle]}>TAF</Text>
        <Text style={[ts.bodySecondary, styles.heroSub]}>Teste de Aptidão Física</Text>
      </View>

      <PressableScale onPress={() => goTo('AplicarTAF')} style={styles.ctaWrap}>
        <Card elevated style={styles.ctaCard}>
          <View style={styles.ctaRow}>
            <View style={styles.ctaText}>
              <Text style={ts.h1}>Aplicar TAF</Text>
              <Text style={[ts.caption, styles.ctaGap]}>
                Corrida · Natação · Permanência
              </Text>
            </View>
            <View style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
              <ChevronRight size={22} color="#FFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>
      </PressableScale>

      <Text style={[ts.label, styles.sectionLabel]}>Acesso rápido</Text>
      <Menu options={quickLinks} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  hero: { marginBottom: 28, alignItems: 'center', width: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeLogo: { width: 18, height: 18, borderRadius: 4 },
  badgeLabel: { textTransform: 'none', letterSpacing: 0.3, fontSize: 12 },
  heroTitle: { textAlign: 'center', width: '100%' },
  heroSub: { marginTop: 6, textAlign: 'center', width: '100%' },
  ctaWrap: { marginBottom: 24 },
  ctaCard: { borderWidth: 0 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { flex: 1, paddingRight: 14 },
  ctaGap: { marginTop: 6 },
  ctaBtn: {
    width: 52,
    height: 52,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { marginBottom: 12 },
});
