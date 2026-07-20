import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { SyncLiveStatusModal } from '../components/sismav/SyncLiveStatusModal';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { StatCard } from '../components/sismav/StatCard';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import {
  getAllSessoesAplicacao,
  getDeletedSessoesAplicacao,
} from '../services/resultadosAplicadosIndexedDb';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from '../utils/resultadoGeralHistorico';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafGlassPanel } from '../components/mobile/TafTabChrome';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import {
  ensureDatabaseBankCode,
  readCachedDatabaseBankCode,
} from '../services/supabase/databaseRegistryCloud';

const tafImage = require('../../TAF1.png');

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

/** Parte local do e-mail + "@" — ex.: lopes.thiago.oliveira@marinha.mil.br → lopes.thiago.oliveira@ */
function emailPrefixoExibicao(email: string | null | undefined): string | null {
  const raw = (email ?? '').trim().toLowerCase();
  if (!raw) return null;
  const at = raw.indexOf('@');
  if (at <= 0) return null;
  return `${raw.slice(0, at)}@`;
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { isNarrowPhone } = useAplicarTafLayout();
  const { user, authReady, isAuthenticated, firebaseEnabled, dataOwnerUid } = useAuth();
  const { syncUi, pendingCount, startSyncFromToggle } = useOfflineSyncState();
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(RESUMO_INICIAL);
  const [syncStatusModalVisible, setSyncStatusModalVisible] = useState(false);

  const emailPrefixo = useMemo(
    () => (isAuthenticated ? emailPrefixoExibicao(user?.email) : null),
    [isAuthenticated, user?.email],
  );

  const [bankCode, setBankCode] = useState<string | null>(() =>
    isAuthenticated ? readCachedDatabaseBankCode(dataOwnerUid) : null,
  );

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      if (!isAuthenticated || !dataOwnerUid) {
        if (!cancelled) setBankCode(null);
        return;
      }
      if (!cancelled) setBankCode(readCachedDatabaseBankCode(dataOwnerUid));
      const code = await ensureDatabaseBankCode(dataOwnerUid);
      if (!cancelled) setBankCode(code);
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, dataOwnerUid, user?.uid]);

  const syncPendingTotal = useMemo(() => {
    const uploads = syncUi.counters.pendingUploads ?? pendingCount;
    const downloads = syncUi.counters.pendingDownloads ?? 0;
    return uploads + downloads;
  }, [pendingCount, syncUi.counters.pendingDownloads, syncUi.counters.pendingUploads]);

  /** Abre modal de status; se houver pendência e não estiver syncando, dispara sync em background. */
  const handleSyncPress = useCallback(() => {
    setSyncStatusModalVisible(true);
    if (!syncUi.isSyncing && syncPendingTotal > 0) {
      void startSyncFromToggle();
    }
  }, [startSyncFromToggle, syncUi.isSyncing, syncPendingTotal]);

  const syncSaveIconState = useMemo((): 'idle' | 'pending' | 'success' => {
    if (syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date') {
      return syncPendingTotal > 0 ? 'pending' : 'success';
    }
    if (syncPendingTotal > 0 || syncUi.isSyncing) return 'pending';
    return 'idle';
  }, [syncUi.phase, syncUi.isSyncing, syncPendingTotal]);

  const recarregarResumo = useCallback(async () => {
    if (!authReady) return;
    try {
      const [cadastros, sessoes, sessoesExcluidas] = await Promise.all([
        getAllCadastros(),
        getAllSessoesAplicacao(),
        getDeletedSessoesAplicacao(),
      ]);
      setResumo(calcularResumoInicioTafFromHistorico(sessoes, cadastros, sessoesExcluidas));
    } catch {
      // Mantém resumo anterior — falha de rede não zera a tela.
    }
    if (isAuthenticated && dataOwnerUid) {
      try {
        const code = await ensureDatabaseBankCode(dataOwnerUid);
        setBankCode(code);
      } catch {
        // mantém código anterior
      }
    }
  }, [authReady, isAuthenticated, user?.uid, dataOwnerUid]);

  useAuthDataReload(recarregarResumo);

  return (
    <MobileScreenScaffold scroll={false} style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.headerBlock}>
        <View style={styles.titleBlock}>
          <Text
            style={[
              theme.textStyles.brandTitle,
              styles.titleCenter,
              { fontSize: isNarrowPhone ? 26 : 28 },
            ]}
          >
            TAF
          </Text>
          <LinearGradient
            colors={[theme.primary, '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleRule}
          />
          <Text style={[styles.subtitleCenter, { color: theme.textSecondary }]}>
            Teste de Aptidão Física
          </Text>
          {emailPrefixo ? (
            <Text
              style={[styles.emailPrefix, { color: theme.textMuted }]}
              numberOfLines={1}
              accessibilityLabel={`Conta ${emailPrefixo}`}
            >
              {emailPrefixo}
            </Text>
          ) : null}
          {bankCode ? (
            <Text
              style={[styles.bankCode, { color: theme.textMuted }]}
              numberOfLines={1}
              accessibilityLabel={`Banco de dados ${bankCode}`}
            >
              {bankCode}
            </Text>
          ) : null}
        </View>
        <TopActionIcons
          activeRoute="Home"
          inline
          centered
          onSyncPress={firebaseEnabled ? handleSyncPress : undefined}
          syncPendingBadge={syncPendingTotal > 0 ? syncPendingTotal : 0}
          syncSaveIconState={syncSaveIconState}
        />
      </View>

      <TafGlassPanel accent="cyan" style={styles.statsPanel}>
        <View style={styles.statsGrid}>
          <StatCard
            label="Cadastrados"
            value={resumo.totalCadastrados.toLocaleString('pt-BR')}
            variant="primary"
          />
          <StatCard
            label="Concluídos"
            value={resumo.completos.toLocaleString('pt-BR')}
            variant="positive"
          />
          <StatCard
            label="Parcial"
            value={resumo.parcial.toLocaleString('pt-BR')}
            variant="warning"
          />
          <StatCard
            label="Pendente"
            value={resumo.semTeste.toLocaleString('pt-BR')}
            variant="negative"
          />
        </View>
      </TafGlassPanel>

      <TafGlassPanel accent="violet" style={styles.imagePanel}>
        <View
          style={[
            styles.imageFrame,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          <Image
            source={tafImage}
            style={styles.tafImage}
            resizeMode="cover"
            accessibilityLabel="TAF"
          />
        </View>
      </TafGlassPanel>

      <SyncLiveStatusModal
        visible={syncStatusModalVisible}
        onClose={() => setSyncStatusModalVisible(false)}
      />
    </MobileScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100%' as unknown as number) : 0,
  },
  pageContent: {
    flexGrow: 1,
    paddingTop: 6,
    gap: 12,
  },
  headerBlock: {
    width: '100%',
    flexShrink: 0,
    alignItems: 'center',
    gap: 8,
    ...(Platform.OS === 'web' ? { overflow: 'visible' as const, zIndex: 10 } : null),
  },
  titleBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  titleCenter: {
    textAlign: 'center',
    width: '100%',
  },
  titleRule: {
    width: 32,
    height: 2,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 2,
  },
  subtitleCenter: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
  },
  emailPrefix: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  bankCode: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
    letterSpacing: 0.8,
  },
  statsPanel: {
    flexShrink: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  imagePanel: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 380 : 220,
  },
  imageFrame: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 340 : 180,
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tafImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
