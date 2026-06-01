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
import { Search, Download, X, Trash2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { PressableScale } from './premium/PressableScale';
import { ConfirmacaoExcluirResultadoModal } from './sismav/ConfirmacaoExcluirResultadoModal';
import { addCadastro, getAllCadastros } from '../services/cadastrosIndexedDb';
import { RubricaThumb } from './RubricaThumb';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import {
  cadastroComAlgumResultadoTaf,
  cadastroParaLinhaResultado,
  filtrarCadastrosPorNipNome,
  mesclarRubricasNaLinha,
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
  type ResultadoTafLinha,
} from '../utils/resultadoTafCadastro';
import {
  carregarRubricasDasSessoesPorNip,
  mesclarRubricas,
  rubricasDoCadastro,
  type RubricasPorNip,
} from '../utils/rubricasDasSessoes';
import {
  limparResultadoModalidadeCadastro,
  type ModalidadeResultadoTaf,
} from '../utils/limparResultadoModalidade';
import { exportResultadosTafPdf } from '../utils/exportResultadosTafPdf';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

function situacaoStyle(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return { color: theme.gain, fontWeight: '700' as const };
  if (situacao === 'Reprovado') return { color: theme.loss, fontWeight: '700' as const };
  return { color: theme.textMuted };
}

function linhasComRubricasMescladas(
  cadastros: Awaited<ReturnType<typeof getAllCadastros>>,
  rubricasSessoes: Map<string, RubricasPorNip>,
): ResultadoTafLinha[] {
  return cadastros
    .filter(cadastroComAlgumResultadoTaf)
    .map((c) => {
      const linha = cadastroParaLinhaResultado(c);
      const key = nipDigitos(c.nip);
      const rub = mesclarRubricas(rubricasDoCadastro(c), key ? rubricasSessoes.get(key) : undefined);
      return mesclarRubricasNaLinha(linha, rub);
    });
}

export function ResultadosConsultaPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [linhas, setLinhas] = useState<ResultadoTafLinha[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [mensagemBusca, setMensagemBusca] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [modalTodosPdf, setModalTodosPdf] = useState(false);
  const [todosCadastros, setTodosCadastros] = useState<Awaited<ReturnType<typeof getAllCadastros>>>([]);
  const [rubricasSessoes, setRubricasSessoes] = useState<Map<string, RubricasPorNip>>(new Map());
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<{
    cadastroId: string;
    nome: string;
    nip: string;
    modalidade: ModalidadeResultadoTaf;
  } | null>(null);

  const carregarBase = useCallback(async () => {
    const lista = await getAllCadastros();
    const rub = await carregarRubricasDasSessoesPorNip();
    setTodosCadastros(lista);
    setRubricasSessoes(rub);
    return lista;
  }, []);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  const executarBusca = useCallback(async () => {
    setAviso(null);
    setMensagemBusca(null);
    const nipTrim = nip.trim();
    const nomeTrim = nome.trim();
    if (!nipTrim && !nomeTrim) {
      setLinhas([]);
      setBuscou(false);
      setAviso('Informe o NIP ou o nome para buscar.');
      return;
    }

    const lista = todosCadastros.length ? todosCadastros : await carregarBase();
    const cadastrados = filtrarCadastrosPorNipNome(lista, nipTrim, nomeTrim, {
      somenteComResultadoTaf: false,
    });
    const comResultado = cadastrados.filter(cadastroComAlgumResultadoTaf);

    setBuscou(true);
    setLinhas(linhasComRubricasMescladas(comResultado, rubricasSessoes));

    if (cadastrados.length === 0) {
      setMensagemBusca('Dados não Encontrados no Sistema');
    } else if (comResultado.length === 0) {
      setMensagemBusca('Militar Cadastrado não realizou TAF');
    }
  }, [nip, nome, todosCadastros, rubricasSessoes, carregarBase]);

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
      const todasLinhas = linhasComRubricasMescladas(comResultado, rubricasSessoes);
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
  }, [todosCadastros, rubricasSessoes, carregarBase]);

  const executarExclusaoModalidade = useCallback(async () => {
    if (!confirmarExclusao) return;
    setExcluindo(true);
    setAviso(null);
    try {
      const lista = todosCadastros.length ? todosCadastros : await carregarBase();
      const cadastro = lista.find((c) => c.id === confirmarExclusao.cadastroId);
      if (!cadastro) {
        setAviso('Cadastro não encontrado.');
        return;
      }
      const atualizado = limparResultadoModalidadeCadastro(cadastro, confirmarExclusao.modalidade);
      await addCadastro(atualizado);
      const novaBase = lista.map((c) => (c.id === atualizado.id ? atualizado : c));
      setTodosCadastros(novaBase);
      setLinhas((prev) => {
        if (!cadastroComAlgumResultadoTaf(atualizado)) {
          setMensagemBusca('Militar Cadastrado não realizou TAF');
          return prev.filter((l) => l.id !== atualizado.id);
        }
        const key = nipDigitos(atualizado.nip);
        const rub = mesclarRubricas(rubricasDoCadastro(atualizado), key ? rubricasSessoes.get(key) : undefined);
        const linha = mesclarRubricasNaLinha(cadastroParaLinhaResultado(atualizado), rub);
        return prev.map((l) => (l.id === atualizado.id ? linha : l));
      });
      setConfirmarExclusao(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir o resultado.');
    } finally {
      setExcluindo(false);
    }
  }, [confirmarExclusao, todosCadastros, rubricasSessoes, carregarBase]);

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

      {buscou && mensagemBusca && linhas.length === 0 ? (
        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Text style={[ts.body, styles.infoText, { color: theme.text }]}>{mensagemBusca}</Text>
        </View>
      ) : null}

      {linhas.map((r) => {
        const cadastro = todosCadastros.find((c) => c.id === r.id);
        const podeExcluirCorrida = cadastro ? temAvaliacaoCorrida(cadastro) : r.notaCorrida !== '—';
        const podeExcluirNatacao = cadastro ? temAvaliacaoNatacao(cadastro) : r.notaNatacao !== '—';
        const podeExcluirPermanencia = cadastro
          ? temAvaliacaoPermanencia(cadastro)
          : r.permanenciaTempo !== '—';

        const abrirExclusao = (modalidade: ModalidadeResultadoTaf) => {
          setConfirmarExclusao({
            cadastroId: r.id,
            nome: r.nome,
            nip: r.nip,
            modalidade,
          });
        };

        return (
          <Card key={r.id} elevated style={styles.resultCard}>
            <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
            <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{r.nip}</Text>
            <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
            <Text style={[ts.h2, { color: ui.text, marginBottom: 12, fontSize: 18 }]}>{r.nome}</Text>

            <View style={styles.provaBlock}>
              <View style={styles.provaHeader}>
                <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>
                  Corrida
                </Text>
                {podeExcluirCorrida ? (
                  <PressableScale
                    onPress={() => abrirExclusao('corrida')}
                    style={[styles.trashBtn, { borderColor: theme.border, backgroundColor: theme.lossMuted }]}
                    accessibilityLabel="Excluir resultado de corrida"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.valorRubricaRow}>
                <View style={styles.provaRow}>
                  <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
                  <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaCorrida}</Text>
                </View>
                <RubricaThumb svgUri={r.rubricaCorridaSvg} />
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoCorrida, theme)]}>
                {r.situacaoCorrida}
              </Text>
            </View>

            <View style={styles.provaBlock}>
              <View style={styles.provaHeader}>
                <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>
                  Natação
                </Text>
                {podeExcluirNatacao ? (
                  <PressableScale
                    onPress={() => abrirExclusao('natacao')}
                    style={[styles.trashBtn, { borderColor: theme.border, backgroundColor: theme.lossMuted }]}
                    accessibilityLabel="Excluir resultado de natação"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.valorRubricaRow}>
                <View style={styles.provaRow}>
                  <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
                  <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaNatacao}</Text>
                </View>
                <RubricaThumb svgUri={r.rubricaNatacaoSvg} />
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoNatacao, theme)]}>
                {r.situacaoNatacao}
              </Text>
            </View>

            <View style={styles.provaBlock}>
              <View style={styles.provaHeader}>
                <Text style={[ts.caption, styles.provaTitulo, { color: theme.textSecondary }]}>
                  Permanência
                </Text>
                {podeExcluirPermanencia ? (
                  <PressableScale
                    onPress={() => abrirExclusao('permanencia')}
                    style={[styles.trashBtn, { borderColor: theme.border, backgroundColor: theme.lossMuted }]}
                    accessibilityLabel="Excluir resultado de permanência"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.provaRow}>
                <Text style={[ts.caption, { color: theme.textMuted }]}>Tempo: </Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.permanenciaTempo}</Text>
              </View>
              <View style={styles.valorRubricaRow}>
                <Text style={[ts.caption, situacaoStyle(r.situacaoPermanencia, theme)]}>
                  {r.situacaoPermanencia}
                </Text>
                <RubricaThumb svgUri={r.rubricaPermanenciaSvg} />
              </View>
            </View>
          </Card>
        );
      })}

      <ConfirmacaoExcluirResultadoModal
        visible={!!confirmarExclusao}
        nome={confirmarExclusao?.nome ?? ''}
        nip={confirmarExclusao?.nip ?? ''}
        modalidade={confirmarExclusao?.modalidade ?? null}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setConfirmarExclusao(null);
        }}
        onConfirm={() => void executarExclusaoModalidade()}
      />

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
  infoBox: {
    padding: 18,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 22,
  },
  resultCard: { padding: 16, marginBottom: 12 },
  provaBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
  provaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  provaTitulo: { fontWeight: '800', textTransform: 'uppercase' },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  provaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  valorRubricaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
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
