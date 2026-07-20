import React from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { BackupTafCsvBlock } from '../components/BackupTafCsvBlock';
import { ExcluirTodosDadosBlock } from '../components/ExcluirTodosDadosBlock';
import { AuthorizedEmailsBlock } from '../components/AuthorizedEmailsBlock';
import { useAuth } from '../contexts/AuthContext';

export default function ConfiguracoesScreen() {
  const { theme, isDark, setThemeMode } = useTheme();
  const { isBoss, isAuthenticated, firebaseEnabled } = useAuth();
  const navigation = useNavigation();
  const ts = theme.textStyles;

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="Configurações" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card elevated>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={ts.h2}>Aparência</Text>
              <Text style={[ts.caption, styles.gap]}>
                {isDark ? 'Modo escuro · padrão ao iniciar' : 'Modo claro ativo'}
              </Text>
            </View>
            <Switch
              value={!isDark}
              onValueChange={(modoClaro) => setThemeMode(modoClaro ? 'light' : 'dark')}
              accessibilityLabel="Ativar modo claro"
              trackColor={{ false: theme.border, true: theme.accentMuted }}
              thumbColor={!isDark ? theme.primary : '#FFFFFF'}
            />
          </View>
        </Card>

        {isAuthenticated && firebaseEnabled && isBoss ? (
          <Card elevated>
            <Text style={ts.h2}>E-mails autorizados</Text>
            <AuthorizedEmailsBlock />
          </Card>
        ) : null}

        <Card elevated>
          <Text style={ts.h2}>Backup e restauração</Text>
          <Text style={[ts.caption, styles.sectionHint, { color: theme.textSecondary }]}>
            Faça backup completo do sistema ou restaure a partir de um arquivo CSV exportado anteriormente.
          </Text>
          <BackupTafCsvBlock />
        </Card>

        {isAuthenticated && firebaseEnabled && isBoss ? (
          <Card elevated>
            <Text style={[ts.h2, { color: theme.loss }]}>Zona de perigo</Text>
            <Text style={[ts.caption, styles.sectionHint, { color: theme.textSecondary }]}>
              Exclua todos os cadastros e resultados para deixar o sistema vazio — na nuvem e nos e-mails
              autorizados. Requer confirmação dupla.
            </Text>
            <ExcluirTodosDadosBlock />
          </Card>
        ) : null}

        <Text style={[ts.caption, styles.footer]}>
          Design SISMAV · modo escuro por padrão · preferência salva localmente.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowText: { flex: 1, paddingRight: 12 },
  gap: { marginTop: 6 },
  sectionHint: { marginTop: 6, marginBottom: 14, lineHeight: 18 },
  footer: { textAlign: 'center', paddingHorizontal: 8, lineHeight: 20 },
});
