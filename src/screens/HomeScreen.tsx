import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';
import { Card } from '../components/Card';
import { PressableScale } from '../components/premium/PressableScale';
import { FileText, ChevronRight } from 'lucide-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();

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
      subtitle: 'CGCFN-108 · busca integrada',
      onPress: () => goTo('Normas'),
    },
    {
      id: 'registro',
      title: 'Registrador de TAF',
      subtitle: 'Histórico e filtros',
      onPress: () => goTo('AplicacaoTAF'),
    },
  ];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: theme.accentMuted, borderColor: theme.primary }]}>
          <Text style={[styles.badgeText, { color: theme.primary }]}>TAF · Premium</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>TAF</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Teste de Aptidão Física
        </Text>
      </View>

      <PressableScale onPress={() => goTo('AplicarTAF')} style={styles.ctaWrap}>
        <Card elevated>
          <View style={styles.ctaRow}>
            <View style={styles.ctaText}>
              <Text style={[styles.ctaTitle, { color: theme.text }]}>Aplicar TAF</Text>
              <Text style={[styles.ctaSub, { color: theme.textSecondary }]}>
                Corrida · Natação · Permanência
              </Text>
            </View>
            <View style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
              <ChevronRight size={22} color="#FFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>
      </PressableScale>

      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ACESSO RÁPIDO</Text>
      <Menu options={quickLinks} />

      <PressableScale onPress={() => goTo('Cadastro')} style={styles.linkWrap}>
        <Card>
          <View style={styles.linkRow}>
            <FileText size={20} color={theme.primary} strokeWidth={2} />
            <View style={styles.linkText}>
              <Text style={[styles.linkTitle, { color: theme.text }]}>Cadastro</Text>
              <Text style={[styles.linkSub, { color: theme.textSecondary }]}>
                Participantes e planilha
              </Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </View>
        </Card>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  hero: { marginBottom: 24, alignItems: 'center' },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },
  ctaWrap: { marginBottom: 20 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { flex: 1, paddingRight: 12 },
  ctaTitle: { fontSize: 18, fontWeight: '800' },
  ctaSub: { fontSize: 13, marginTop: 4 },
  ctaBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  linkWrap: { marginTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  linkText: { flex: 1, marginLeft: 12 },
  linkTitle: { fontSize: 16, fontWeight: '700' },
  linkSub: { fontSize: 13, marginTop: 2 },
});
