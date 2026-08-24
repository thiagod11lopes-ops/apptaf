import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { StatCard } from '../components/sismav/StatCard';
import { ReprovadosInicioModal } from '../components/home/ReprovadosInicioModal';
import { RestritosInicioModal } from '../components/home/RestritosInicioModal';
import { type ResumoInicioTafHistorico } from '../utils/resultadoGeralHistorico';
import {
  isHomeResumoCacheWarm,
  loadResumoInicioFromIndexedDb,
  peekHomeResumoCache,
} from '../utils/homeResumoIndexedDb';
import { runAfterFirstPaint } from '../utils/runAfterFirstPaint';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafGlassPanel } from '../components/mobile/TafTabChrome';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import { navigateTab } from '../navigation/navigationRef';
import {
  ensureDatabaseBankCode,
  readCachedDatabaseBankCode,
} from '../services/supabase/databaseRegistryCloud';
import { listRecentKnownAuthEmails } from '../offline-first/auth/knownAuthEmails';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import {
  isCloudLinkEnabled,
  subscribeCloudLink,
} from '../offline-first/sync/cloudLinkPreference';
import { peekSessoesListCache } from '../services/sessoesListCache';
import { ResultadosResumoModal } from '../components/ResultadosResumoModal';
import { AgendamentoConfigModal } from '../components/home/AgendamentoConfigModal';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
const tafImage = require('../../TAF1.png');

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
  restritos: 0,
  fatoresRisco: 0,
  cadastroIncompleto: 0,
  reprovados: 0,
};

/** Debounce do cálculo dos cards (foco + notifyDataChanged coalescido). */
const HOME_RESUMO_DEBOUNCE_MS = 600;

function resumoInicioEquals(a: ResumoInicioTafHistorico, b: ResumoInicioTafHistorico): boolean {
  return (
    a.totalCadastrados === b.totalCadastrados &&
    a.completos === b.completos &&
    a.parcial === b.parcial &&
    a.semTeste === b.semTeste &&
    a.restritos === b.restritos &&
    a.fatoresRisco === b.fatoresRisco &&
    a.cadastroIncompleto === b.cadastroIncompleto &&
    (a.reprovados ?? 0) === (b.reprovados ?? 0)
  );
}

function formatPctLabel(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

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
  /** Hidrata com último resumo (mesmo dirty) — evita flash de zeros ao remount. */
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(
    () => peekHomeResumoCache() ?? RESUMO_INICIAL,
  );
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressReprovadosAnim = useRef(new Animated.Value(0)).current;
  const [emailFixoPrefixo, setEmailFixoPrefixo] = useState<string | null>(null);
  /** Só inicia I/O dos cards após o 1º paint. */
  const cardsPaintReadyRef = useRef(false);
  const [cardsPaintReady, setCardsPaintReady] = useState(false);
  const [resumoModalAberto, setResumoModalAberto] = useState(false);
  const [sessoesResumo, setSessoesResumo] = useState<SessaoAplicacaoTaf[]>([]);
  const [modalReprovadosVisible, setModalReprovadosVisible] = useState(false);
  const [modalRestritosVisible, setModalRestritosVisible] = useState(false);
  const [agendamentoModalAberto, setAgendamentoModalAberto] = useState(false);

  const handleAbrirResumo = useCallback(async () => {
    const cached = peekSessoesListCache({ includeDemo: false });
    if (cached) {
      setSessoesResumo(cached);
    } else {
      const { getAllSessoesAplicacao } = await import('../services/resultadosAplicadosIndexedDb');
      const all = await getAllSessoesAplicacao({ includeDemo: false });
      setSessoesResumo(all);
    }
    setResumoModalAberto(true);
  }, []);

  const pctConcluidos = useMemo(() => {
    const total = resumo.totalCadastrados;
    if (total <= 0) return 0;
    const participantes = resumo.completos + (resumo.parcial ?? 0);
    return Math.min(100, Math.max(0, (participantes / total) * 100));
  }, [resumo.completos, resumo.parcial, resumo.totalCadastrados]);

  const pctConcluidosLabel = useMemo(() => formatPctLabel(pctConcluidos), [pctConcluidos]);

  const pctReprovados = useMemo(() => {
    const total = resumo.totalCadastrados;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, ((resumo.reprovados ?? 0) / total) * 100));
  }, [resumo.reprovados, resumo.totalCadastrados]);

  const pctReprovadosLabel = useMemo(() => formatPctLabel(pctReprovados), [pctReprovados]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: pctConcluidos,
      friction: 9,
      tension: 48,
      useNativeDriver: false,
    }).start();
  }, [pctConcluidos, progressAnim]);

  useEffect(() => {
    Animated.spring(progressReprovadosAnim, {
      toValue: pctReprovados,
      friction: 9,
      tension: 48,
      useNativeDriver: false,
    }).start();
  }, [pctReprovados, progressReprovadosAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const progressReprovadosWidth = progressReprovadosAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  /** E-mail da sessão atual ou o último login salvo neste aparelho (fixo na Home). */
  const emailPrefixo = useMemo(() => {
    const fromSession = emailPrefixoExibicao(user?.email);
    return fromSession ?? emailFixoPrefixo;
  }, [user?.email, emailFixoPrefixo]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromSession = emailPrefixoExibicao(user?.email);
      if (fromSession) {
        if (!cancelled) setEmailFixoPrefixo(fromSession);
        return;
      }
      try {
        const recent = await listRecentKnownAuthEmails(1);
        const prefix = emailPrefixoExibicao(recent[0]);
        if (!cancelled && prefix) setEmailFixoPrefixo(prefix);
      } catch {
        // mantém o que já estiver
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email, isAuthenticated]);

  const [bankCode, setBankCode] = useState<string | null>(() =>
    isAuthenticated ? readCachedDatabaseBankCode(dataOwnerUid) : null,
  );
  const [cloudLinkOn, setCloudLinkOn] = useState(isCloudLinkEnabled);

  useEffect(() => subscribeCloudLink(setCloudLinkOn), []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      const owner = dataOwnerUid ?? getCachedDataOwnerUid();
      if (!owner) {
        // Mantém código já exibido se houver (não apaga ao desligar nuvem).
        return;
      }
      if (!cancelled) setBankCode(readCachedDatabaseBankCode(owner));
      // Etapa 17: hydrate do registry na nuvem só com chave ligada.
      if (isAuthenticated && cloudLinkOn) {
        const code = await ensureDatabaseBankCode(owner);
        if (!cancelled) setBankCode(code);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, dataOwnerUid, user?.uid, cloudLinkOn]);

  /** Cards = espelho local (Dexie) com cache SWR. Debounce evita tempestade. */
  const resumoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumoInFlightRef = useRef(false);
  const resumoPendingRef = useRef(false);

  const loadResumoNow = useCallback(async () => {
    if (!cardsPaintReadyRef.current) return;

    // Pinta stale na hora (remount / foco) — sem esperar Dexie.
    const peeked = peekHomeResumoCache();
    if (peeked) {
      setResumo((prev) => (resumoInicioEquals(prev, peeked) ? prev : peeked));
    }

    // Cache fresco: troca de aba sem re-scan.
    if (isHomeResumoCacheWarm()) return;

    if (resumoInFlightRef.current) {
      resumoPendingRef.current = true;
      return;
    }
    resumoInFlightRef.current = true;
    try {
      do {
        resumoPendingRef.current = false;
        try {
          const next = await loadResumoInicioFromIndexedDb({ force: true });
          setResumo((prev) => (resumoInicioEquals(prev, next) ? prev : next));
        } catch (error) {
          console.warn('[home] falha ao recalcular cards:', error);
        }
      } while (resumoPendingRef.current);
    } finally {
      resumoInFlightRef.current = false;
    }
  }, []);

  const scheduleRecarregarResumo = useCallback(
    (mode: 'immediate' | 'debounce' = 'debounce') => {
      if (!cardsPaintReadyRef.current) return;

      // Foco com cache quente: nada a fazer.
      if (mode === 'immediate' && isHomeResumoCacheWarm()) {
        const peeked = peekHomeResumoCache();
        if (peeked) {
          setResumo((prev) => (resumoInicioEquals(prev, peeked) ? prev : peeked));
        }
        return;
      }

      if (resumoDebounceRef.current) {
        clearTimeout(resumoDebounceRef.current);
        resumoDebounceRef.current = null;
      }
      if (mode === 'immediate') {
        void loadResumoNow();
        return;
      }
      // Mutação: se ainda há valor na tela, debounce o refresh em background.
      resumoDebounceRef.current = setTimeout(() => {
        resumoDebounceRef.current = null;
        void loadResumoNow();
      }, HOME_RESUMO_DEBOUNCE_MS);
    },
    [loadResumoNow],
  );

  useEffect(() => {
    return runAfterFirstPaint(() => {
      cardsPaintReadyRef.current = true;
      setCardsPaintReady(true);
    });
  }, []);

  useEffect(
    () => () => {
      if (resumoDebounceRef.current) clearTimeout(resumoDebounceRef.current);
    },
    [],
  );

  // Foco + mutação local / pós-sync.
  useAuthDataReload(() => {
    if (isHomeResumoCacheWarm()) {
      const peeked = peekHomeResumoCache();
      if (peeked) {
        setResumo((prev) => (resumoInicioEquals(prev, peeked) ? prev : peeked));
      }
      return;
    }
    // Com stale dirty: refresh em background; UI já mostra último valor.
    scheduleRecarregarResumo(peekHomeResumoCache() ? 'debounce' : 'immediate');
  }, {
    scopes: ['cadastros', 'sessoes', 'fatores', 'restritos'],
  });

  // Primeiro paint: imediato só se precisar (miss ou dirty).
  useEffect(() => {
    if (!cardsPaintReady) return;
    scheduleRecarregarResumo('immediate');
  }, [cardsPaintReady, scheduleRecarregarResumo]);

  return (
    <>
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
          onResumo={handleAbrirResumo}
          onAgendamento={() => setAgendamentoModalAberto(true)}
        />
      </View>

      <ResultadosResumoModal
        visible={resumoModalAberto}
        onClose={() => setResumoModalAberto(false)}
        sessoes={sessoesResumo}
      />

      <AgendamentoConfigModal
        visible={agendamentoModalAberto}
        onClose={() => setAgendamentoModalAberto(false)}
      />

      <TafGlassPanel accent="cyan" style={styles.statsPanel}>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="Cadastrados"
              value={resumo.totalCadastrados.toLocaleString('pt-BR')}
              variant="primary"
            />
            <StatCard
              label="Pendentes"
              value={resumo.semTeste.toLocaleString('pt-BR')}
              variant="negative"
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
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Reprovados"
              value={(resumo.reprovados ?? 0).toLocaleString('pt-BR')}
              variant="negative"
              accessibilityLabel={`Reprovados em pelo menos um teste: ${resumo.reprovados ?? 0}. Abrir lista detalhada.`}
              onPress={() => setModalReprovadosVisible(true)}
            />
            <StatCard
              label="Restritos"
              value={(resumo.restritos ?? 0).toLocaleString('pt-BR')}
              variant="warning"
              accessibilityLabel={`Restritos: ${resumo.restritos ?? 0}. Abrir lista detalhada.`}
              onPress={() => setModalRestritosVisible(true)}
            />
            <StatCard
              label="Fatores de risco"
              value={(resumo.fatoresRisco ?? 0).toLocaleString('pt-BR')}
              variant="negative"
            />
            <StatCard
              label="CADAS. INCOMP"
              value={(resumo.cadastroIncompleto ?? 0).toLocaleString('pt-BR')}
              variant="warning"
              accessibilityLabel={`Cadastros incompletos: ${resumo.cadastroIncompleto ?? 0}. Abrir planilha filtrada.`}
              onPress={() =>
                navigateTab('Cadastro', { abrirPlanilhaIncompletos: true })
              }
            />
          </View>
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
          accessibilityLabel={`Participação nos testes: ${pctConcluidosLabel}`}
        >
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
              Participação nos testes
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

        <View
          style={styles.progressBlock}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(pctReprovados),
            text: pctReprovadosLabel,
          }}
          accessibilityLabel={`Reprovados: ${pctReprovadosLabel}`}
        >
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
              Reprovados
            </Text>
            <Text style={[styles.progressPct, { color: theme.error }]}>
              {pctReprovadosLabel}
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
            <Animated.View style={[styles.progressFillWrap, { width: progressReprovadosWidth }]}>
              <LinearGradient
                colors={['#b91c1c', '#dc2626', '#f43f5e', '#fb7185']}
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
                styles.progressGlowReprovados,
                {
                  opacity: pctReprovados > 0 ? 0.55 : 0,
                  width: `${Math.max(pctReprovados, 0)}%`,
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

      <ReprovadosInicioModal
        visible={modalReprovadosVisible}
        onClose={() => setModalReprovadosVisible(false)}
      />
      <RestritosInicioModal
        visible={modalRestritosVisible}
        onClose={() => setModalRestritosVisible(false)}
      />
    </>
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
    width: '100%',
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
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
  progressGlowReprovados: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(220, 38, 38, 0.5), 0 0 4px rgba(251, 113, 133, 0.35)',
        } as object)
      : {
          shadowColor: '#dc2626',
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
