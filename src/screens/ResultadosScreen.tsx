import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import { PressableScale } from '../components/premium/PressableScale';
import type { RootStackParamList } from '../navigation/types';
import {
  getAllSessoesAplicacao,
  tituloTipoProva,
  type SessaoAplicacaoTaf,
} from '../services/resultadosAplicadosIndexedDb';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Resultados'>;

export default function ResultadosScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const [sessoes, setSessoes] = useState<SessaoAplicacaoTaf[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    getAllSessoesAplicacao()
      .then(setSessoes)
      .finally(() => setCarregando(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const abrirSessao = useCallback(
    (sessao: SessaoAplicacaoTaf) => {
      navigation.navigate('CadastrarResultados', { resultados: sessao.resultados });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={[ts.h2, styles.title]}>Resultados</Text>
          <Text style={[ts.bodySecondary, { color: theme.textSecondary }]}>
            Histórico de todas as provas aplicadas no TAF
          </Text>
        </View>

        {carregando ? (
          <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center' }]}>Carregando…</Text>
        ) : null}

        {!carregando && sessoes.length === 0 ? (
          <Card elevated style={styles.emptyCard}>
            <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
              Nenhuma aplicação registrada ainda.
            </Text>
            <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
              Use a aba Aplicar para registrar provas; os resultados aparecerão aqui.
            </Text>
          </Card>
        ) : null}

        {sessoes.map((sessao) => {
          const titulo = tituloTipoProva(sessao.tipoProva);
          const qtd = sessao.resultados.length;
          const aprovados = sessao.resultados.filter(
            (r) => r.notaTexto !== 'REPROVADO' && r.reprovacaoTexto == null,
          ).length;

          return (
            <PressableScale
              key={sessao.id}
              onPress={() => abrirSessao(sessao)}
              style={styles.itemPress}
            >
              <Card elevated style={styles.sessaoCard}>
                <View style={styles.sessaoRow}>
                  <View style={styles.sessaoText}>
                    <Text style={[ts.label, { color: theme.primary }]}>{titulo}</Text>
                    <Text style={[ts.h2, { color: ui.text, marginTop: 4 }]}>
                      {sessao.dataAplicacao}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textMuted, marginTop: 6 }]}>
                      {qtd} participante{qtd !== 1 ? 's' : ''}
                      {sessao.tipoProva === 'permanencia'
                        ? ` · ${aprovados} aprovado${aprovados !== 1 ? 's' : ''}`
                        : null}
                    </Text>
                  </View>
                  <ChevronRight size={22} color={ui.icon} strokeWidth={2.5} />
                </View>
              </Card>
            </PressableScale>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  hero: {
    marginBottom: 20,
    paddingRight: 56,
  },
  title: {
    marginBottom: 6,
  },
  emptyCard: {
    padding: 24,
  },
  emptyHint: {
    marginTop: 8,
    lineHeight: 18,
  },
  itemPress: {
    marginBottom: 12,
  },
  sessaoCard: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  sessaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PREMIUM.minTouch,
  },
  sessaoText: {
    flex: 1,
    paddingRight: 8,
  },
});
