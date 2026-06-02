import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { Menu } from '../components/Menu';
import { AppHeader } from '../components/sismav/AppHeader';
import { StatCard } from '../components/sismav/StatCard';
import { BookOpen, ClipboardList } from 'lucide-react-native';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from '../utils/resultadoGeralHistorico';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const RESUMO_INICIAL: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const navigation = useNavigation<Nav>();
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

  const goTo = useCallback(
    (screen: keyof RootStackParamList) => {
      navigation.navigate(screen as never);
    },
    [navigation],
  );

  const quickLinks = [
    {
      id: 'normas',
      title: 'Normas',
      subtitle: 'CGCFN-108 · Planilha de Consulta',
      Icon: BookOpen,
      onPress: () => goTo('Normas'),
    },
    {
      id: 'registro',
      title: 'Registrador de TAF',
      subtitle: 'Histórico e filtros',
      Icon: ClipboardList,
      onPress: () => goTo('AplicacaoTAF'),
    },
  ];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: 'transparent' }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader title="TAF" subtitle="Teste de Aptidão Física" />

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

      <Text style={[ts.label, styles.sectionLabel]}>Acesso rápido</Text>
      <Menu options={quickLinks} />
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
    marginBottom: 24,
  },
  sectionLabel: { marginBottom: 12 },
});
