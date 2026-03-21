import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, FileDown } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatElapsedMs } from '../utils/formatRaceTime';
import { exportResumoAplicacaoPdf } from '../utils/exportResumoAplicacaoPdf';

type Props = NativeStackScreenProps<RootStackParamList, 'CadastrarResultados'>;

export default function CadastrarResultadosScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const resultados = route.params?.resultados ?? [];
  const textoColunaCadastro = useMemo(() => {
    const temNatacao = resultados.some((r) => r.prova === 'natacao');
    const temCorrida = resultados.some((r) => r.prova !== 'natacao');
    if (temNatacao && !temCorrida) return 'Natação';
    if (temCorrida && !temNatacao) return 'Corrida';
    return 'Corrida e Natação';
  }, [resultados]);
  const grayBg = theme.background;
  const cardGlassEnabled = Platform.OS === 'web';
  const inputBorder = 'rgba(17,24,39,0.12)';
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const onGerarPdf = useCallback(async () => {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    try {
      await exportResumoAplicacaoPdf(resultados, textoColunaCadastro);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      Alert.alert('Gerar PDF', msg);
    } finally {
      setGerandoPdf(false);
    }
  }, [gerandoPdf, resultados, textoColunaCadastro]);

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
              <ChevronLeft size={26} color="#6B7280" strokeWidth={2.5} />
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

            <TouchableOpacity
              accessibilityLabel="Gerar PDF do resumo"
              activeOpacity={0.85}
              onPress={() => {
                void onGerarPdf();
              }}
              disabled={gerandoPdf}
              style={[styles.btnGerarPdf, gerandoPdf ? styles.btnGerarPdfDisabled : null]}
            >
              {gerandoPdf ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FileDown size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.btnGerarPdfText}>Gerar PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.dicaPdf}>
              {Platform.OS === 'web'
                ? 'No navegador, use “Salvar como PDF” na janela de impressão.'
                : 'Será gerado um PDF para salvar ou compartilhar.'}
            </Text>

            {resultados.length === 0 ? (
              <Text style={styles.vazioText}>Nenhum resultado nesta sessão.</Text>
            ) : null}

            {resultados.map((r) => (
              <View
                key={`${r.prova ?? 'corrida'}-${r.corredor}`}
                style={[styles.resultadoRow, { borderColor: inputBorder, backgroundColor: '#FFFFFF' }]}
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
                <Text style={styles.tempoText}>{formatElapsedMs(r.tempoMs)}</Text>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Estilos alinhados a CadastroScreenModern / AplicarTAFScreen */
const styles = StyleSheet.create({
  safe: { flex: 1, position: 'relative' as const },
  scrollContentCadastro: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 28 },
  centerWrap: { flex: 1, alignItems: 'center' as const },
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
    color: '#111827',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formCard: {
    width: '100%',
    maxWidth: 720,
    marginTop: 8,
    padding: 18,
    borderRadius: 20,
  },
  sectionTitleCadastro: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(17,24,39,0.8)',
    marginBottom: 10,
  },
  introCadastro: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 19,
    marginBottom: 16,
  },
  introStrong: { fontWeight: '900', color: '#111827' },
  btnGerarPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#111827',
  },
  btnGerarPdfDisabled: {
    opacity: 0.72,
  },
  btnGerarPdfText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dicaPdf: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 16,
  },
  vazioText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
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
    color: '#6B7280',
    marginBottom: 4,
  },
  nomeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  nipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tempoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
  },
});
