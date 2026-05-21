import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Image, useWindowDimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';
import { Card } from '../components/Card';
import { MonoValue } from '../components/fintech/MonoValue';
import { FINTECH } from '../theme/fintech';
import { Zap } from 'lucide-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setMenuVisible(true);
    }, []),
  );

  const goTo = useCallback(
    (screen: 'Normas' | 'Cadastro' | 'AplicacaoTAF' | 'AplicarTAF' | 'Estatisticas' | 'Configuracoes') => {
      setMenuVisible(false);
      setTimeout(() => navigation.navigate(screen), 120);
    },
    [navigation],
  );

  const menuOptionsAntesRegistrar = [
    { id: 'normas', title: 'Normas', subtitle: 'CGCFN-108 · busca e tabelas', onPress: () => goTo('Normas') },
    { id: 'cadastro', title: 'Cadastro', subtitle: 'Participantes e planilha', onPress: () => goTo('Cadastro') },
    { id: 'aplicacao-taf', title: 'Registrador de TAF', subtitle: 'Histórico e filtros', onPress: () => goTo('AplicacaoTAF') },
  ];

  const menuOptionsDepoisRegistrar = [
    { id: 'estatisticas', title: 'Estatísticas', subtitle: 'Dashboard e métricas', onPress: () => goTo('Estatisticas') },
    { id: 'configuracoes', title: 'Configurações', subtitle: 'Tema e preferências', onPress: () => goTo('Configuracoes') },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
        Platform.OS !== 'web' && { width, height },
      ]}
    >
      <Image
        source={require('../../Fundo.png')}
        style={[styles.fundo, { width, height, opacity: 0.35 }]}
        resizeMode="cover"
      />
      <View style={[styles.overlay, { width, height }]} />
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.badge, { backgroundColor: theme.gainMuted, borderColor: theme.gain }]}>
            <Zap size={14} color={theme.gain} strokeWidth={2.5} />
            <Text style={[styles.badgeText, { color: theme.gain }]}>TAF · Alta performance</Text>
          </View>
          <MonoValue size="xl">TAF</MonoValue>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Teste de Aptidão Física
          </Text>
        </View>

        {menuVisible ? (
          <>
            <Menu options={menuOptionsAntesRegistrar} />
            <Card onPress={() => goTo('AplicarTAF')} style={styles.ctaCard} elevated>
              <View style={styles.ctaInner}>
                <View>
                  <Text style={[styles.ctaTitle, { color: theme.text }]}>Aplicar TAF</Text>
                  <Text style={[styles.ctaSubtitle, { color: theme.textSecondary }]}>
                    Corrida · Natação · Permanência
                  </Text>
                </View>
                <View style={[styles.ctaPill, { backgroundColor: theme.primary }]}>
                  <Text style={styles.ctaPillText}>Iniciar</Text>
                </View>
              </View>
            </Card>
            <Menu options={menuOptionsDepoisRegistrar} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 32 : 48,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: FINTECH.radiusSm,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  ctaCard: {
    marginBottom: 12,
    paddingVertical: 4,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  ctaPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: FINTECH.radiusMd,
    minWidth: 72,
    alignItems: 'center',
  },
  ctaPillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
