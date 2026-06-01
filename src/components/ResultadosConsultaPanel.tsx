import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Search, Download, X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { formatNipInput } from '../utils/nipFormat';
import {
  cadastroComAlgumResultadoTaf,
  cadastroParaLinhaResultado,
  filtrarCadastrosPorNipNome,
  linhasResultadoFromCadastros,
  type ResultadoTafLinha,
} from '../utils/resultadoTafCadastro';
import { exportResultadosTafPdf } from '../utils/exportResultadosTafPdf';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

function situacaoStyle(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return { color: theme.gain, fontWeight: '700' as const };
  if (situacao === 'Reprovado') return { color: theme.loss, fontWeight: '700' as const };
  return { color: theme.textMuted };
}

export function ResultadosConsultaPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [linhas, setLinhas] = useState<ResultadoTafLinha[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [modalTodosPdf, setModalTodosPdf] = useState(false);
  const [todosCadastros, setTodosCadastros] = useState<Awaited<ReturnType<typeof getAllCadastros>>>([]);

  const carregarBase = useCallback(async () => {
    const lista = await getAllCadastros();
    setTodosCadastros(lista);
    return lista;
  }, []);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  const executarBusca = useCallback(async () => {
    setAviso(null);
    const nipTrim = nip.trim();
    const nomeTrim = nome.trim();
    if (!nipTrim && !nomeTrim) {
      setLinhas([]);
      setBuscou(false);
      setAviso('Informe o NIP ou o nome para buscar.');
      return;
    }

    const lista = todosCadastros.length ? todosCadastros : await carregarBase();
    const encontrados = filtrarCadastrosPorNipNome(lista, nipTrim, nomeTrim);
    setBuscou(true);
    setLinhas(encontrados.map(cadastroParaLinhaResultado));

    if (encontrados.length === 0) {
      setAviso('Nenhum militar com resultado encontrado para os dados informados.');
    }
  }, [nip, nome, todosCadastros, carregarBase]);

  const handleBaixar = useCallback(async () => {
    setAviso(null);

    if (!nip.trim() && !nome.trim()) {
      setModalTodosPdf(true);
      return;
    }

    if (!buscou || linhas.length === 0) {
      setAviso('Busque um militar antes de baixar o PDF filtrado.');
      return;
    }

    setCarregandoPdf(true);
    try {
      const subtitulo = `Filtro: ${[nip.trim() && `NIP ${nip.trim()}`, nome.trim() && `Nome ${nome.trim()}`]
        .filter(Boolean)
        .join(' · ')}`;
      await exportResultadosTafPdf(linhas, subtitulo);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao gerar PDF.');
    } finally {
      setCarregandoPdf(false);
    }
  }, [nip, nome, buscou, linhas]);

  const confirmarPdfTodos = useCallback(async () => {
    setModalTodosPdf(false);
    setCarregandoPdf(true);
    try {
      const lista = todosCadastros.length ? todosCadastros : await carregarBase();
      const comResultado = lista.filter(cadastroComAlgumResultadoTaf);
      const todasLinhas = linhasResultadoFromCadastros(comResultado);
      if (todasLinhas.length === 0) {
        setAviso('Nenhum integrante com resultado registrado no sistema.');
        return;
      }
      await exportResultadosTafPdf(
        todasLinhas,
        'Todos os integrantes com ao menos um resultado (corrida, natação ou permanência)',
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao gerar PDF.');
    } finally {
      setCarregandoPdf(false);
    }
  }, [todosCadastros, carregarBase]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.cardBg,
      borderColor: theme.border,
      color: theme.text,
    },
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Busque por NIP ou nome para ver notas e situação em corrida, natação e permanência.
      </Text>

      <Card elevated style={styles.formCard}>
        <View style={styles.field}>
          <LabelNip color={theme.text} fontSize={14} fontWeight={600} />
          <TextInput
            value={nip}
            onChangeText={(t) => setNip(formatNipInput(t))}
            placeholder="00.0000.00"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
            keyboardType="numeric"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[ts.label, styles.labelGap]}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do militar"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          accessibilityLabel="Buscar resultado"
          onPress={() => void executarBusca()}
          style={[styles.btnBuscar, { backgroundColor: theme.primary }]}
        >
          <Search size={18} color={theme.text} strokeWidth={2.2} />
          <Text style={[ts.caption, styles.btnBuscarText, { color: theme.text }]}>Buscar</Text>
        </TouchableOpacity>
      </Card>

      <TouchableOpacity
        accessibilityLabel="Baixar Resultados"
        disabled={carregandoPdf}
        onPress={() => void handleBaixar()}
        style={[
          styles.btnDownload,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
          carregandoPdf ? { opacity: 0.7 } : null,
        ]}
      >
        {carregandoPdf ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <Download size={18} color={theme.text} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnDownloadText, { color: theme.text }]}>
              Baixar Resultados
            </Text>
          </>
        )}
      </TouchableOpacity>

      {aviso ? (
        <Text style={[ts.caption, styles.aviso, { color: theme.loss }]}>{aviso}</Text>
      ) : null}

      {linhas.map((r) => (
        <Card key={r.id} elevated style={styles.resultCard}>
          <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
          <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{r.nip}</Text>
          <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
          <Text style={[ts.h2, { color: ui.text, marginBottom: 12, fontSize: 18 }]}>{r.nome}</Text>

          <View style={styles.provaBlock}>
            <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>Corrida</Text>
            <View style={styles.provaRow}>
              <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
              <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaCorrida}</Text>
            </View>
            <Text style={[ts.caption, situacaoStyle(r.situacaoCorrida, theme)]}>
              {r.situacaoCorrida}
            </Text>
          </View>

          <View style={styles.provaBlock}>
            <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>Natação</Text>
            <View style={styles.provaRow}>
              <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
              <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaNatacao}</Text>
            </View>
            <Text style={[ts.caption, situacaoStyle(r.situacaoNatacao, theme)]}>
              {r.situacaoNatacao}
            </Text>
          </View>

          <View style={styles.provaBlock}>
            <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>
              Permanência
            </Text>
            <View style={styles.provaRow}>
              <Text style={[ts.caption, { color: theme.textMuted }]}>Tempo: </Text>
              <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.permanenciaTempo}</Text>
            </View>
            <Text style={[ts.caption, situacaoStyle(r.situacaoPermanencia, theme)]}>
              {r.situacaoPermanencia}
            </Text>
          </View>
        </Card>
      ))}

      <Modal visible={modalTodosPdf} transparent animationType="fade" onRequestClose={() => setModalTodosPdf(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[ts.h2, { color: theme.text, flex: 1 }]}>Baixar todos os resultados?</Text>
              <TouchableOpacity
                onPress={() => setModalTodosPdf(false)}
                accessibilityLabel="Fechar"
                style={[styles.modalClose, { borderColor: theme.border }]}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[ts.bodySecondary, { color: theme.textSecondary, lineHeight: 20 }]}>
              Será gerado um PDF com todos os integrantes que possuem ao menos um resultado em corrida,
              natação ou permanência.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setModalTodosPdf(false)}
                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void confirmarPdfTodos()}
                style={[styles.modalBtn, { borderColor: theme.primary, backgroundColor: theme.primary }]}
              >
                <Text style={[ts.caption, { color: theme.text, fontWeight: '800' }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { marginBottom: 14, lineHeight: 20 },
  formCard: { padding: 16, marginBottom: 14 },
  field: { marginBottom: 14 },
  labelGap: { marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btnBuscar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    marginTop: 4,
  },
  btnBuscarText: { fontWeight: '800' },
  btnDownload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    marginBottom: 16,
  },
  btnDownloadText: { fontWeight: '800' },
  aviso: { marginBottom: 12, textAlign: 'center' },
  resultCard: { padding: 16, marginBottom: 12 },
  provaBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
  provaTitulo: { fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
  provaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
  },
});
