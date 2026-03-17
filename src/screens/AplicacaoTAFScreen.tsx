import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';

export default function AplicacaoTAFScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Aplicação do TAF" onBack={() => navigation.goBack()} />
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.text }}>Aplicação do Teste de Aptidão Física.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
