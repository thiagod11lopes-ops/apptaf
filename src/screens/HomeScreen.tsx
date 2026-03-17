import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState(true);

  const goTo = useCallback(
    (screen: 'Normas' | 'Cadastro' | 'AplicacaoTAF' | 'Estatisticas') => {
      setMenuVisible(false);
      setTimeout(() => navigation.navigate(screen), 150);
    },
    [navigation]
  );

  const options = [
    { id: 'normas', title: 'Normas', subtitle: 'Documentos e normas organizados', onPress: () => goTo('Normas') },
    { id: 'cadastro', title: 'Cadastro', subtitle: 'Cadastrar informações no sistema', onPress: () => goTo('Cadastro') },
    { id: 'aplicacao-taf', title: 'Aplicação do TAF', subtitle: 'Aplicar o Teste de Aptidão Física', onPress: () => goTo('AplicacaoTAF') },
    { id: 'estatisticas', title: 'Estatísticas', subtitle: 'Análise e métricas dos dados', onPress: () => goTo('Estatisticas') },
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
        <Menu options={options} visible={menuVisible} />
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
});
