import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { BackupTafCsvBlock } from '../components/BackupTafCsvBlock';
import { ExcluirTodosDadosBlock } from '../components/ExcluirTodosDadosBlock';
import { ExclusoesEspecificasDangerBlock } from '../components/ExclusoesEspecificasDangerBlock';
import { AuthorizedEmailsBlock } from '../components/AuthorizedEmailsBlock';
import { CloudLinkToggle } from '../components/premium/CloudLinkToggle';
import { SyncLiveStatusModal } from '../components/sismav/SyncLiveStatusModal';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import {
  isCloudLinkEnabled,
  setCloudLinkEnabled,
  subscribeCloudLink,
} from '../offline-first/sync/cloudLinkPreference';
import { syncManager } from '../offline-first/sync/SyncManager';
import {
  ensureDatabaseBankCode,
  readCachedDatabaseBankCode,
} from '../services/supabase/databaseRegistryCloud';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';

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
  const { isBoss, isAuthenticated, firebaseEnabled, authReady, dataOwnerUid } = useAuth();
  const { startSyncFromToggle, cancelOnlineMode } = useOfflineSyncState();
  const navigation = useNavigation();
  const ts = theme.textStyles;
  const showBossSections = isAuthenticated && firebaseEnabled && isBoss;

  // Seções começam fechadas ao entrar em Configurações.
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [cloudLinkOn, setCloudLinkOn] = useState(isCloudLinkEnabled);
  const [togglingCloud, setTogglingCloud] = useState(false);
  const [syncStatusModalVisible, setSyncStatusModalVisible] = useState(false);
  const [bankCode, setBankCode] = useState<string | null>(() =>
    isAuthenticated ? readCachedDatabaseBankCode(dataOwnerUid) : null,
  );

  useEffect(() => subscribeCloudLink(setCloudLinkOn), []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      const owner = dataOwnerUid ?? getCachedDataOwnerUid();
      if (!owner) return;
      if (!cancelled) setBankCode(readCachedDatabaseBankCode(owner));
      // Etapa 17: registry na nuvem só com chave ligada.
      if (isAuthenticated && cloudLinkOn) {
        const code = await ensureDatabaseBankCode(owner);
        if (!cancelled) setBankCode(code);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, dataOwnerUid, cloudLinkOn]);

  useFocusEffect(
    useCallback(() => {
      setEmailsOpen(false);
      setBackupOpen(false);
      setDangerOpen(false);
    }, []),
  );

  const openSyncStatus = useCallback(() => {
    setSyncStatusModalVisible(true);
    if (!isCloudLinkEnabled()) return;
    void syncManager.refreshCloudDiff({ forcePull: true }).catch(() => {});
  }, []);

  const onToggleCloudLink = useCallback(
    async (next: boolean) => {
      if (togglingCloud) return;
      if (next && !isAuthenticated) {
        Alert.alert('Login necessário', 'Faça login para ligar a conexão com a nuvem.');
        return;
      }
      setTogglingCloud(true);
      try {
        setCloudLinkEnabled(next);
        if (next) {
          // Mesmo fluxo do ícone da nuvem: abre o modal e inicia a sincronização.
          setSyncStatusModalVisible(true);
          const res = await startSyncFromToggle();
          if (!res.ok) {
            setCloudLinkEnabled(false);
            setSyncStatusModalVisible(false);
            Alert.alert('Nuvem', res.error ?? 'Não foi possível conectar à nuvem.');
            return;
          }
          void syncManager.refreshCloudDiff({ forcePull: true }).catch(() => {});
        } else {
          cancelOnlineMode();
          setSyncStatusModalVisible(false);
        }
      } finally {
        setTogglingCloud(false);
      }
    },
    [togglingCloud, isAuthenticated, startSyncFromToggle, cancelOnlineMode],
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

        <Card elevated>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={ts.h2}>Conexão com a nuvem</Text>
              <Text style={[ts.caption, styles.gap]}>
                {cloudLinkOn
                  ? 'BNC ligado · sincronizando aparelho com a nuvem'
                  : 'BNC desligado · dados apenas neste aparelho'}
              </Text>
              <Pressable
                onPress={openSyncStatus}
                accessibilityRole="button"
                accessibilityLabel="Ver status da sincronização com a nuvem"
                hitSlop={8}
                style={styles.syncStatusLinkWrap}
              >
                <Text style={[ts.caption, { color: theme.primary, fontWeight: '700' }]}>
                  Ver atualizações
                </Text>
              </Pressable>
            </View>
            <CloudLinkToggle
              value={cloudLinkOn}
              onValueChange={(v) => void onToggleCloudLink(v)}
              disabled={togglingCloud}
              bankLabel={bankCode?.trim() || 'BNC'}
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
            hint="Exclusões irreversíveis. Use as opções específicas para apagar só testes, só testes do Modo Teste, só fatores de risco, só restritos/dispensas ou só datas de nascimento dos cadastrados, ou a exclusão total para esvaziar o sistema. Sempre há confirmação antes de apagar."
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

      <SyncLiveStatusModal
        visible={syncStatusModalVisible}
        onClose={() => setSyncStatusModalVisible(false)}
      />
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
  syncStatusLinkWrap: { marginTop: 8, alignSelf: 'flex-start' },
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
