import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';

export default function ConfiguracoesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Configurações" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={{ color: theme.text }}>
          Área de configurações do sistema (em desenvolvimento).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
});

