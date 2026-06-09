import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { cabecalhoColunaProvaResultados } from '../utils/exportResumoAplicacaoPdf';
import { getUiColors, type UiColors } from '../theme/uiColors';
import type { AppTheme } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'CadastrarResultados'>;

export default function CadastrarResultadosScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const styles = useMemo(() => createCadastrarResultadosStyles(theme, ui), [theme, ui]);
  const resultados = route.params?.resultados ?? [];
  const textoColunaCadastro = useMemo(() => {
    const temNatacao = resultados.some((r) => r.prova === 'natacao');
    const temCorrida = resultados.some((r) => r.prova !== 'natacao');
    if (temNatacao && !temCorrida) return 'Natação';
    if (temCorrida && !temNatacao) return 'Corrida';
    return 'Corrida e Natação';
  }, [resultados]);
  const tituloColunaPapel = useMemo(
    () => cabecalhoColunaProvaResultados(resultados),
    [resultados],
  );
  const grayBg = theme.background;
  const cardGlassEnabled = Platform.OS === 'web';
  const inputBorder = theme.border;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: grayBg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContentCadastro}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerWrap}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityLabel="Voltar"
            >
              <ChevronLeft size={26} color={ui.icon} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.pageTitle}>Aplicar Resultado</Text>
            </View>
          </View>

          <Card glass={cardGlassEnabled} style={styles.formCard}>
            <Text style={styles.sectionTitleCadastro}>Resumo da aplicação</Text>
            <Text style={styles.introCadastro}>
              Os tempos compatíveis com o cadastro já foram gravados na coluna{' '}
              <Text style={styles.introStrong}>{textoColunaCadastro}</Text> da planilha de Cadastro. Abaixo, o
              resumo desta aplicação.
            </Text>

            {resultados.length === 0 ? (
              <Text style={styles.vazioText}>Nenhum resultado nesta sessão.</Text>
            ) : null}

            {resultados.length > 0 ? (
              <Text style={styles.tabelaHeaderResumo}>{tituloColunaPapel}</Text>
            ) : null}

            {resultados.map((r) => (
              <View
                key={`${r.prova ?? 'corrida'}-${r.corredor}`}
                style={[styles.resultadoRow, { borderColor: inputBorder, backgroundColor: ui.inputBg }]}
              >
                <Text style={styles.corredorLabel}>
                  {(r.prova === 'natacao' ? 'Nadador' : 'Corredor')} {r.corredor}
                </Text>
                <Text style={styles.nomeText} numberOfLines={2}>
                  {r.nome}
                </Text>
                {r.nip ? (
                  <Text style={styles.nipText} numberOfLines={1}>
                    NIP {r.nip}
                  </Text>
                ) : null}
                <View style={styles.linhaTempoNota}>
                  <Text style={styles.tempoText}>
                    {formatMsByModality(r.prova ?? 'corrida', r.tempoMs)}
                  </Text>
                  {r.notaTexto != null && r.notaTexto !== '' ? (
                    <View style={styles.blocoNotaCorrida}>
                      <Text style={styles.notaResumoLabel}>NOTA</Text>
                      <Text
                        style={[
                          styles.notaResumoValor,
                          r.notaTexto === 'REPROVADO' ? styles.notaResumoRepro : null,
                        ]}
                      >
                        {r.notaTexto}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createCadastrarResultadosStyles(theme: AppTheme, ui: UiColors) {
  const ink = ui.text;
  const sub = ui.textSecondary;
  const muted = ui.textMuted;
  return StyleSheet.create({
    safe: { flex: 1, position: 'relative' as const },
    scrollContentCadastro: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 28 },
    centerWrap: { flex: 1, alignItems: 'stretch' as const },
    headerRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 14,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleWrap: { flex: 1 },
    pageTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: ink,
      textShadowColor: theme.isDark ? 'transparent' : 'rgba(0,0,0,0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    formCard: {
      ...tableFullWidthStyle,
      marginTop: 8,
      padding: 18,
      borderRadius: 20,
    },
    sectionTitleCadastro: {
      fontSize: 14,
      fontWeight: '800',
      color: ink,
      marginBottom: 10,
    },
    introCadastro: {
      fontSize: 13,
      fontWeight: '700',
      color: sub,
      lineHeight: 19,
      marginBottom: 16,
    },
    introStrong: { fontWeight: '900', color: ink },
    vazioText: {
      fontSize: 13,
      fontWeight: '700',
      color: muted,
      marginBottom: 8,
    },
    tabelaHeaderResumo: {
      fontSize: 12,
      fontWeight: '900',
      color: sub,
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    resultadoRow: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
    },
    corredorLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: muted,
      marginBottom: 4,
    },
    nomeText: {
      fontSize: 15,
      fontWeight: '900',
      color: ink,
      marginBottom: 4,
    },
    nipText: {
      fontSize: 12,
      fontWeight: '600',
      color: sub,
      marginBottom: 8,
    },
    tempoText: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.isDark ? ink : '#15803D',
    },
    linhaTempoNota: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: 16,
    },
    blocoNotaCorrida: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    notaResumoLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: muted,
    },
    notaResumoValor: {
      fontSize: 14,
      fontWeight: '900',
      color: ink,
    },
    notaResumoRepro: {
      color: theme.isDark ? ink : '#B91C1C',
      fontSize: 12,
    },
  });
}
