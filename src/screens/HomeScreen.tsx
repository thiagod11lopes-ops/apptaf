import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { StatCard } from '../components/sismav/StatCard';
import { type ResumoInicioTafHistorico } from '../utils/resultadoGeralHistorico';
import { loadResumoInicioFromIndexedDb } from '../utils/homeResumoIndexedDb';
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
  restritos: 0,
  fatoresRisco: 0,
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
  const { user, authReady, isAuthenticated, dataOwnerUid } = useAuth();
  const { syncUi } = useOfflineSyncState();
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(RESUMO_INICIAL);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const pctConcluidos = useMemo(() => {
    const total = resumo.totalCadastrados;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (resumo.completos / total) * 100));
  }, [resumo.completos, resumo.totalCadastrados]);

  const pctConcluidosLabel = useMemo(() => {
    const rounded = Math.round(pctConcluidos * 10) / 10;
    return `${rounded.toLocaleString('pt-BR', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    })}%`;
  }, [pctConcluidos]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: pctConcluidos,
      friction: 9,
      tension: 48,
      useNativeDriver: false,
    }).start();
  }, [pctConcluidos, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

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

  /** Cards = espelho local do banco na nuvem (atualizado automaticamente online). */
  const recarregarResumo = useCallback(async () => {
    try {
      const next = await loadResumoInicioFromIndexedDb();
      setResumo(next);
    } catch (error) {
      console.warn('[home] falha ao recalcular cards:', error);
    }
    if (isAuthenticated && dataOwnerUid) {
      try {
        const code = await ensureDatabaseBankCode(dataOwnerUid);
        setBankCode(code);
      } catch {
        // mantém código anterior
      }
    }
  }, [isAuthenticated, dataOwnerUid]);

  useAuthDataReload(recarregarResumo);

  // Após sync automático (sucesso, já atualizado ou erro), atualiza os cards.
  useEffect(() => {
    const phase = syncUi.phase;
    if (
      phase === 'success' ||
      phase === 'already_up_to_date' ||
      phase === 'error' ||
      phase === 'offline'
    ) {
      void recarregarResumo();
    }
  }, [syncUi.phase, recarregarResumo]);

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
        <TopActionIcons activeRoute="Home" inline centered />
      </View>

      <TafGlassPanel accent="cyan" style={styles.statsPanel}>
        <View style={styles.statsGrid}>
          <StatCard
            label="Cadastrados"
            value={resumo.totalCadastrados.toLocaleString('pt-BR')}
            variant="primary"
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
          <StatCard
            label="Restritos"
            value={(resumo.restritos ?? 0).toLocaleString('pt-BR')}
            variant="warning"
          />
          <StatCard
            label="Concluídos"
            value={resumo.completos.toLocaleString('pt-BR')}
            variant="positive"
          />
          <StatCard
            label="Fatores de risco"
            value={(resumo.fatoresRisco ?? 0).toLocaleString('pt-BR')}
            variant="negative"
          />
        </View>

        <View
          style={styles.progressBlock}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(pctConcluidos),
            text: pctConcluidosLabel,
          }}
          accessibilityLabel={`Conclusão dos testes: ${pctConcluidosLabel}`}
        >
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
              Conclusão dos testes
            </Text>
            <Text style={[styles.progressPct, { color: theme.success }]}>
              {pctConcluidosLabel}
            </Text>
          </View>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor:
                  Platform.OS === 'web' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(15, 23, 42, 0.12)',
                borderColor: theme.border,
              },
            ]}
          >
            <Animated.View style={[styles.progressFillWrap, { width: progressWidth }]}>
              <LinearGradient
                colors={['#059669', '#10b981', '#34d399', '#22d3ee']}
                locations={[0, 0.35, 0.7, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.progressFill}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.progressSheen}
                />
              </LinearGradient>
            </Animated.View>
            <View
              pointerEvents="none"
              style={[
                styles.progressGlow,
                {
                  opacity: pctConcluidos > 0 ? 0.55 : 0,
                  width: `${Math.max(pctConcluidos, 0)}%`,
                },
              ]}
            />
          </View>
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
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  progressBlock: {
    width: '100%',
    gap: 8,
    paddingTop: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressPct: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  progressFillWrap: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 0,
  },
  progressFill: {
    flex: 1,
    height: '100%',
    borderRadius: 999,
  },
  progressSheen: {
    ...StyleSheet.absoluteFillObject,
    height: '55%',
  },
  progressGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(16, 185, 129, 0.55), 0 0 4px rgba(34, 211, 238, 0.4)',
        } as object)
      : {
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.65,
          shadowRadius: 8,
        }),
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
