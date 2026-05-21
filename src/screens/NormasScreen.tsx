import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { NormsContentDisplay } from '../components/NormsContentDisplay';
import { CGCFN_108_NORM_CONTENT } from '../data/normasData'; // Importar o conteúdo da norma

export default function NormasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Normas" onBack={() => navigation.goBack()} />
      <NormsContentDisplay normContent={CGCFN_108_NORM_CONTENT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
