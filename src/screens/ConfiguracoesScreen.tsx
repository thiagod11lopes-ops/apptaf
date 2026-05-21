import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { FINTECH } from '../theme/fintech';

export default function ConfiguracoesScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Configurações" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Card elevated>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: theme.text }]}>Modo escuro (OLED)</Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Dashboard profissional · cores de status suaves
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.borderMuted, true: theme.gainMuted }}
              thumbColor={isDark ? theme.gain : theme.textSecondary}
            />
          </View>
        </Card>
        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Interface otimizada para PWA mobile-first · animações rápidas (150–200ms)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: { flex: 1 },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
