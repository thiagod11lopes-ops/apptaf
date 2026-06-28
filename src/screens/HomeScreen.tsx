import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { AppHeader } from '../components/sismav/AppHeader';
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
import { PREMIUM } from '../theme/premium';
import { MobileGlassShell } from '../components/mobile/MobileGlassShell';
import { useMobileLayout } from '../components/mobile/useMobileLayout';
import { isNativeMobileApp } from '../components/mobile/MobileScreenScaffold';

const tafImage = require('../../TAF1.png');

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

export default function HomeScreen() {
  const { theme } = useTheme();
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

  const { horizontalPad } = useMobileLayout();
  const nativeMobile = isNativeMobileApp();

  const frameShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: theme.isDark
            ? '0 8px 28px rgba(0,0,0,0.35)'
            : '0 10px 32px rgba(15,23,42,0.08)',
        } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: theme.isDark ? 0.35 : 0.1,
          shadowRadius: 14,
          elevation: 6,
        };

  const body = (
    <>
      <View style={[styles.topSection, nativeMobile ? { paddingHorizontal: horizontalPad } : null]}>
        <AppHeader title="TAF" subtitle="Teste de Aptidão Física" />
        <TopActionIcons
          activeRoute="Home"
          inline
          onSyncPress={firebaseEnabled ? handleSyncPress : undefined}
          syncPendingBadge={syncSaveIconState === 'pending' ? syncPendingTotal : 0}
          syncSaveIconState={syncSaveIconState}
        />

        <View style={styles.statsGrid}>
          <StatCard
            label="Cadastrados"
            value={resumo.totalCadastrados.toLocaleString('pt-BR')}
            variant="primary"
          />
          <StatCard
            label="TAF concluído"
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
      </View>

      <View
        style={[
          styles.imageFrame,
          nativeMobile ? { marginHorizontal: horizontalPad } : null,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.border,
          },
          frameShadow,
        ]}
      >
        <Image
          source={tafImage}
          style={styles.tafImage}
          resizeMode="cover"
          accessibilityLabel="TAF"
        />
      </View>

      <SyncQuickOverlay visible={overlayVisible} />
    </>
  );

  if (nativeMobile) {
    return <MobileGlassShell>{body}</MobileGlassShell>;
  }

  return <View style={styles.page}>{body}</View>;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100%' as unknown as number) : 0,
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 6,
    flexShrink: 0,
    ...(Platform.OS === 'web' ? { overflow: 'visible' as const, zIndex: 10 } : null),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  imageFrame: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 380 : 0,
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    overflow: 'hidden',
  },
  tafImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
