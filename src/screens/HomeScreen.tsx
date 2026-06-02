import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../components/sismav/AppHeader';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { StatCard } from '../components/sismav/StatCard';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from '../utils/resultadoGeralHistorico';

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

export default function HomeScreen() {
  const [resumo, setResumo] = useState<ResumoInicioTafHistorico>(RESUMO_INICIAL);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllCadastros(), getAllSessoesAplicacao()])
        .then(([cadastros, sessoes]) =>
          setResumo(calcularResumoInicioTafFromHistorico(sessoes, cadastros)),
        )
        .catch(() => setResumo(RESUMO_INICIAL));
    }, []),
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader title="TAF" subtitle="Teste de Aptidão Física" />
      <TopActionIcons activeRoute="Home" large />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
