import React, { useCallback, useState, type ReactNode } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { BackupTafCsvBlock } from '../components/BackupTafCsvBlock';
import { ExcluirTodosDadosBlock } from '../components/ExcluirTodosDadosBlock';
import { ExclusoesEspecificasDangerBlock } from '../components/ExclusoesEspecificasDangerBlock';
import { AuthorizedEmailsBlock } from '../components/AuthorizedEmailsBlock';
import { useAuth } from '../contexts/AuthContext';

type CollapsibleSectionProps = {
  title: string;
  titleColor?: string;
  hint?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function CollapsibleSettingsSection({
  title,
  titleColor,
  hint,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  return (
    <Card elevated>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} ${title}`}
        style={styles.collapseHeader}
      >
        <View style={styles.collapseHeaderText}>
          <Text style={[ts.h2, titleColor ? { color: titleColor } : null]}>{title}</Text>
          {!expanded && hint ? (
            <Text style={[ts.caption, styles.collapsePreview, { color: theme.textMuted }]} numberOfLines={2}>
              {hint}
            </Text>
          ) : null}
        </View>
        <ChevronDown
          size={22}
          color={titleColor ?? theme.textSecondary}
          strokeWidth={2.2}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.collapseBody}>
          {hint ? (
            <Text style={[ts.caption, styles.sectionHint, { color: theme.textSecondary }]}>{hint}</Text>
          ) : null}
          {children}
        </View>
      ) : null}
    </Card>
  );
}

export default function ConfiguracoesScreen() {
  const { theme, isDark, setThemeMode } = useTheme();
  const { isBoss, isAuthenticated, firebaseEnabled } = useAuth();
  const navigation = useNavigation();
  const ts = theme.textStyles;
  const showBossSections = isAuthenticated && firebaseEnabled && isBoss;

  // Seções começam fechadas ao entrar em Configurações.
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setEmailsOpen(false);
      setBackupOpen(false);
      setDangerOpen(false);
    }, []),
  );

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

        {showBossSections ? (
          <CollapsibleSettingsSection
            title="E-mails autorizados"
            expanded={emailsOpen}
            onToggle={() => setEmailsOpen((v) => !v)}
            hint="Libere e-mails para acessar o banco do chefe."
          >
            <AuthorizedEmailsBlock />
          </CollapsibleSettingsSection>
        ) : null}

        <CollapsibleSettingsSection
          title="Backup e restauração"
          expanded={backupOpen}
          onToggle={() => setBackupOpen((v) => !v)}
          hint="Faça backup completo do sistema ou restaure a partir de um arquivo CSV exportado anteriormente."
        >
          <BackupTafCsvBlock />
        </CollapsibleSettingsSection>

        {showBossSections ? (
          <CollapsibleSettingsSection
            title="Zona de perigo"
            titleColor={theme.loss}
            expanded={dangerOpen}
            onToggle={() => setDangerOpen((v) => !v)}
            hint="Exclusões irreversíveis. Use as opções específicas para apagar só testes ou só fatores de risco, ou a exclusão total para esvaziar o sistema. Sempre há confirmação antes de apagar."
          >
            <View style={styles.dangerStack}>
              <ExclusoesEspecificasDangerBlock />
              <ExcluirTodosDadosBlock />
            </View>
          </CollapsibleSettingsSection>
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
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  collapseHeaderText: { flex: 1, gap: 4 },
  collapsePreview: { lineHeight: 16 },
  collapseBody: { marginTop: 10 },
  sectionHint: { marginBottom: 14, lineHeight: 18 },
  dangerStack: { gap: 14 },
  footer: { textAlign: 'center', paddingHorizontal: 8, lineHeight: 20 },
});
