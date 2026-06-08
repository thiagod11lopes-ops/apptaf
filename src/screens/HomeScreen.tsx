import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { emailCloudLabel } from '../utils/emailCloudLabel';
import { AppHeader } from '../components/sismav/AppHeader';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { StatCard } from '../components/sismav/StatCard';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { loadHomeCloudData } from '../services/firebase/cloudDataSync';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from '../utils/resultadoGeralHistorico';
import { PREMIUM } from '../theme/premium';

const tafImage = require('../../TAF1.png');

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

const LOAD_IDLE = {
  percent: 0,
  loading: false,
  loadedCadastros: 0,
  loadedSessoes: 0,
  fromCache: false,
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user, isAuthenticated, authReady } = useAuth();
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(RESUMO_INICIAL);
  const [cloudLoad, setCloudLoad] = useState(LOAD_IDLE);

  const cloudLabel = useMemo(() => {
    if (!isAuthenticated) return undefined;
    return emailCloudLabel(user?.email ?? null) ?? undefined;
  }, [isAuthenticated, user?.email]);

  const recarregarResumo = useCallback(async () => {
    if (!authReady) return;

    if (!isAuthenticated) {
      setCloudLoad(LOAD_IDLE);
      try {
        const [cadastros, sessoes] = await Promise.all([
          getAllCadastros(),
          getAllSessoesAplicacao(),
        ]);
        setResumo(calcularResumoInicioTafFromHistorico(sessoes, cadastros));
      } catch {
        setResumo(RESUMO_INICIAL);
      }
      return;
    }

    try {
      const entry = await loadHomeCloudData((state) => {
        setCloudLoad({
          percent: state.percent,
          loading: state.loading,
          loadedCadastros: state.loadedCadastros,
          loadedSessoes: state.loadedSessoes,
          fromCache: state.fromCache,
        });
      });

      if (entry) {
        setResumo(entry.resumo);
      }
    } catch {
      setResumo(RESUMO_INICIAL);
      setCloudLoad(LOAD_IDLE);
    }
  }, [authReady, isAuthenticated]);

  useAuthDataReload(recarregarResumo);

  const cloudLoadProps = useMemo(() => {
    if (!cloudLabel) return undefined;
    return {
      label: cloudLabel,
      percent: cloudLoad.percent,
      loading: cloudLoad.loading,
    };
  }, [cloudLabel, cloudLoad.loading, cloudLoad.percent]);

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

  return (
    <View style={styles.page}>
      <View style={styles.topSection}>
        <AppHeader title="TAF" cloudLoad={cloudLoadProps} subtitle="Teste de Aptidão Física" />
        <TopActionIcons activeRoute="Home" inline />

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
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexShrink: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  imageFrame: {
    flex: 1,
    minHeight: 0,
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
