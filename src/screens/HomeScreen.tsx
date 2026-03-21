import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';
import { Card } from '../components/Card';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setMenuVisible(true);
    }, [])
  );

  const goTo = useCallback(
    (screen: 'Normas' | 'Cadastro' | 'AplicacaoTAF' | 'AplicarTAF' | 'Estatisticas' | 'Configuracoes') => {
      setMenuVisible(false);
      setTimeout(() => navigation.navigate(screen), 150);
    },
    [navigation]
  );

  const menuOptionsAntesRegistrar = [
    { id: 'normas', title: 'Normas', subtitle: 'Documentos e normas organizados', onPress: () => goTo('Normas') },
    { id: 'cadastro', title: 'Cadastro', subtitle: 'Cadastrar informações no sistema', onPress: () => goTo('Cadastro') },
    { id: 'aplicacao-taf', title: 'Registrador de TAF', subtitle: 'Registro de dados dos testes', onPress: () => goTo('AplicacaoTAF') },
  ];

  const menuOptionsDepoisRegistrar = [
    { id: 'estatisticas', title: 'Estatísticas', subtitle: 'Análise e métricas dos dados', onPress: () => goTo('Estatisticas') },
    { id: 'configuracoes', title: 'Configurações', subtitle: 'Ajustes gerais do sistema', onPress: () => goTo('Configuracoes') },
  ];

  const gradientColors: [string, string] = [theme.gradient[0], theme.gradient[1]];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, Platform.OS !== 'web' && { width, height }]}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Image
        source={require('../../Fundo.png')}
        style={[styles.fundo, { width, height }]}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.welcome}>TAF</Text>
        <Text style={styles.subtitle}>Teste de Aptidão Física</Text>
        {menuVisible ? (
          <>
            <Menu options={menuOptionsAntesRegistrar} />
            <Card glass onPress={() => goTo('AplicarTAF')} style={styles.aplicarTafCard}>
              <Text style={styles.aplicarTafTitle}>Aplicar TAF</Text>
              <Text style={styles.aplicarTafSubtitle}>Aplicar o Teste de Aptidão Física</Text>
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
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 24 : 28,
    paddingHorizontal: 24,
  },
  welcome: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
    ...(Platform.OS === 'web' && { textShadow: '0 3px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)' }),
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    ...(Platform.OS === 'web' && { textShadow: '0 2px 6px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.7)' }),
  },
  /** Card “Aplicar TAF” (sem ação por enquanto): mesmo visual do Menu. */
  aplicarTafCard: {
    marginBottom: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    }),
  },
  aplicarTafTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    ...(Platform.OS === 'web' && { textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)' }),
  },
  aplicarTafSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    ...(Platform.OS === 'web' && { textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)' }),
  },
});
