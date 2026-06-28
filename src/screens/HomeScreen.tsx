import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { SyncQuickOverlay } from '../components/sismav/SyncQuickOverlay';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { useSyncQuickOverlay } from '../hooks/useSyncQuickOverlay';
import { StatCard } from '../components/sismav/StatCard';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from '../utils/resultadoGeralHistorico';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafGlassPanel } from '../components/mobile/TafTabChrome';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';

const tafImage = require('../../TAF1.png');

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { isNarrowPhone } = useAplicarTafLayout();
  const { user, authReady, isAuthenticated, firebaseEnabled, dataOwnerUid } = useAuth();
  const { syncUi, pendingCount, startSyncFromToggle } = useOfflineSyncState();
  const { overlayVisible, showOverlay } = useSyncQuickOverlay();
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(RESUMO_INICIAL);

  const syncPendingTotal = useMemo(() => {
    const uploads = syncUi.counters.pendingUploads ?? pendingCount;
    const downloads = syncUi.counters.pendingDownloads ?? 0;
    return uploads + downloads;
  }, [pendingCount, syncUi.counters.pendingDownloads, syncUi.counters.pendingUploads]);

  const handleSyncPress = useCallback(() => {
    if (syncUi.isSyncing) return;
    if (syncPendingTotal > 0) showOverlay();
    void startSyncFromToggle();
  }, [startSyncFromToggle, syncUi.isSyncing, showOverlay, syncPendingTotal]);

  const syncSaveIconState = useMemo((): 'idle' | 'pending' | 'success' => {
    if (syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date') return 'success';
    if (syncUi.isSyncing) return 'idle';
    if (syncPendingTotal > 0) return 'pending';
    return 'idle';
  }, [syncUi.phase, syncUi.isSyncing, syncPendingTotal]);

  const recarregarResumo = useCallback(async () => {
    if (!authReady) return;
    try {
      const [cadastros, sessoes] = await Promise.all([
        getAllCadastros(),
        getAllSessoesAplicacao(),
      ]);
      setResumo(calcularResumoInicioTafFromHistorico(sessoes, cadastros));
    } catch {
      // Mantém resumo anterior — falha de rede não zera a tela.
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
        </View>
        <TopActionIcons
          activeRoute="Home"
          inline
          centered
          onSyncPress={firebaseEnabled ? handleSyncPress : undefined}
          syncPendingBadge={syncSaveIconState === 'pending' ? syncPendingTotal : 0}
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

      <SyncQuickOverlay visible={overlayVisible} />
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
