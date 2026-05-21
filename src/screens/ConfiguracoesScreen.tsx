import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { PREMIUM } from '../theme/premium';

export default function ConfiguracoesScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const ts = theme.textStyles;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Configurações" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Card elevated>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={ts.h2}>Aparência</Text>
              <Text style={[ts.caption, styles.gap]}>
                {isDark ? 'Modo escuro suave · melhor leitura' : 'Modo claro'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D4D4DE', true: theme.accentMuted }}
              thumbColor={isDark ? theme.primary : '#FFFFFF'}
            />
          </View>
        </Card>
        <Text style={[ts.caption, styles.footer]}>
          Tipografia Inter · cores ajustadas para contraste confortável em telas escuras.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowText: { flex: 1, paddingRight: 12 },
  gap: { marginTop: 6 },
  footer: { textAlign: 'center', paddingHorizontal: 8, lineHeight: 20 },
});
