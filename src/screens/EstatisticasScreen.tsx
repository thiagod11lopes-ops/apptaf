import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';

export default function EstatisticasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Estatísticas" onBack={() => navigation.goBack()} />
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.text }}>Análise e métricas dos dados.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
