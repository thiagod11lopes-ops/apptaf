import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';

export default function NormasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Normas" onBack={() => navigation.goBack()} />
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.text }}>Conteúdo de Normas (documentos e normas).</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
