import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Check, ClipboardPlus, Search, X } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { RubricaCaptureModal } from '../RubricaCaptureModal';
import { FluxoAssinaturaAplicadorModal } from './FluxoAssinaturaAplicadorModal';
import { LabelNip } from '../LabelNip';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import type { AplicadorAssinaturaResumo } from '../../types/aplicadorAssinatura';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../utils/nipFormat';
import {
  formatMinutosSegundosInput,
  tempoParaExibicao,
} from '../../utils/formatMinutosSegundos';
import {
  cadastrarResultadosManual,
  validarEdicaoResultadoTaf,
  type EdicaoResultadoTafInput,
} from '../../utils/atualizarResultadoTaf';
import { PREMIUM } from '../../theme/premium';

type Etapa = 'form' | 'rubricaMilitar' | 'aplicador';

type Props = {
  visible: boolean;
  cadastros: CadastroItemPersist[];
  dataAplicacaoBr: string;
  onClose: () => void;
  onSalvo: (atualizado: CadastroItemPersist) => void;
};

function permanenciaInicial(c: CadastroItemPersist): 'aprovado' | 'reprovado' | null {
  const r = c.resultadoPermanencia ?? c.resultadoNatacao;
  if (r === 'aprovado' || r === 'reprovado') return r;
  return null;
}

export function CadastrarResultadosManualModal({
  visible,
  cadastros,
  dataAplicacaoBr,
  onClose,
  onSalvo,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [etapa, setEtapa] = useState<Etapa>('form');
  const [nip, setNip] = useState('');
  const [cadastro, setCadastro] = useState<CadastroItemPersist | null>(null);
  const [avisoBusca, setAvisoBusca] = useState('');
  const [tempoCorrida, setTempoCorrida] = useState('');
  const [tempoNatacao, setTempoNatacao] = useState('');
  const [permanencia, setPermanencia] = useState<'aprovado' | 'reprovado' | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [rubricaMilitarSvg, setRubricaMilitarSvg] = useState('');

  const reset = useCallback(() => {
    setEtapa('form');
    setNip('');
    setCadastro(null);
    setAvisoBusca('');
    setTempoCorrida('');
    setTempoNatacao('');
    setPermanencia(null);
    setErro('');
    setSalvando(false);
    setRubricaMilitarSvg('');
  }, []);

  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible, reset]);

  const fechar = useCallback(() => {
    if (salvando) return;
    onClose();
  }, [salvando, onClose]);

  const aplicarCadastroEncontrado = useCallback((encontrado: CadastroItemPersist) => {
    setCadastro(encontrado);
    setTempoCorrida(tempoParaExibicao(encontrado.tempoCorrida));
    setTempoNatacao(tempoParaExibicao(encontrado.tempoNatacao));
    setPermanencia(permanenciaInicial(encontrado));
    setAvisoBusca('');
  }, []);

  const resolverMilitarPorNip = useCallback(
    (nipRaw: string, opts?: { formatarNip?: boolean; exigirCompleto?: boolean }) => {
      setErro('');
      const digits = nipDigitos(nipRaw);
      if (!digits) {
        setCadastro(null);
        setAvisoBusca('');
        return;
      }

      const res = buscarCadastroPorNomeOuNip(cadastros, nipRaw);
      if (res.kind === 'found') {
        aplicarCadastroEncontrado(res.cadastro);
        if (opts?.formatarNip) setNip(formatNipInput(res.cadastro.nip));
        return;
      }

      // Enquanto digita: se só um cadastro começa com os dígitos, já mostra o nome.
      if (digits.length >= 4 && digits.length < 8) {
        const prefixos = cadastros.filter((c) => nipDigitos(c.nip).startsWith(digits));
        if (prefixos.length === 1) {
          aplicarCadastroEncontrado(prefixos[0]);
          return;
        }
        if (prefixos.length > 1) {
          setCadastro(null);
          setAvisoBusca('');
          return;
        }
      }

      setCadastro(null);
      if (opts?.exigirCompleto || digits.length >= 8) {
        setAvisoBusca(
          res.kind === 'ambiguous'
            ? 'Mais de um cadastro corresponde a este NIP.'
            : 'Militar não encontrado. Cadastre-o antes de lançar resultados.',
        );
      } else {
        setAvisoBusca('');
      }
    },
    [aplicarCadastroEncontrado, cadastros],
  );

  const onChangeNip = useCallback(
    (t: string) => {
      const formatado = formatNipInput(t);
      setNip(formatado);
      resolverMilitarPorNip(formatado);
    },
    [resolverMilitarPorNip],
  );

  const buscarMilitar = useCallback(() => {
    resolverMilitarPorNip(nip, { formatarNip: true, exigirCompleto: true });
  }, [nip, resolverMilitarPorNip]);

  const inputResultados = useMemo(
    (): EdicaoResultadoTafInput => ({
      tempoCorrida,
      tempoNatacao,
      permanencia,
    }),
    [tempoCorrida, tempoNatacao, permanencia],
  );

  const participanteRubrica = useMemo((): ResultadoCorridaItem | null => {
    if (!cadastro) return null;
    return {
      corredor: 1,
      nome: cadastro.nome,
      nip: cadastro.nip,
      tempoMs: 0,
      prova: 'corrida',
      notaTexto: undefined,
    };
  }, [cadastro]);

  const irParaRubricaMilitar = useCallback(() => {
    if (!cadastro) {
      setErro('Busque e selecione o militar pelo NIP.');
      return;
    }
    const validacao = validarEdicaoResultadoTaf(inputResultados);
    if (validacao) {
      setErro(validacao);
      return;
    }
    setErro('');
    setEtapa('rubricaMilitar');
  }, [cadastro, inputResultados]);

  const onRubricaMilitar = useCallback((svg: string) => {
    setRubricaMilitarSvg(svg);
    setEtapa('aplicador');
  }, []);

  const concluirComAplicador = useCallback(
    async (assinatura: AplicadorAssinaturaResumo) => {
      if (!cadastro || salvando) return;
      setSalvando(true);
      setErro('');
      try {
        const atualizado = await cadastrarResultadosManual({
          cadastro,
          input: inputResultados,
          dataAplicacaoBr,
          rubricaMilitarSvg,
          aplicadorAssinatura: assinatura,
        });
        onSalvo(atualizado);
        onClose();
      } catch (e) {
        setEtapa('form');
        setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
      } finally {
        setSalvando(false);
      }
    },
    [
      cadastro,
      salvando,
      inputResultados,
      dataAplicacaoBr,
      rubricaMilitarSvg,
      onSalvo,
      onClose,
    ],
  );

  return (
    <>
      <AppModal
        visible={visible && etapa === 'form'}
        transparent
        animationType="fade"
        onRequestClose={fechar}
      >
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: ui.modalBg, borderColor: theme.border }]}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <ClipboardPlus size={18} color={theme.primary} strokeWidth={2.2} />
                <Text style={[theme.textStyles.label, { color: ui.text }]}>
                  Cadastrar Resultados
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Fechar"
                onPress={fechar}
                style={styles.closeBtn}
                disabled={salvando}
              >
                <X size={18} color={ui.icon} strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={[theme.textStyles.caption, styles.subtitle, { color: theme.textSecondary }]}>
              Data da aplicação: {dataAplicacaoBr}
            </Text>
            <Text style={[theme.textStyles.caption, styles.hint, { color: theme.textMuted }]}>
              Informe o NIP, lance os resultados e avance para as rúbricas do militar e do
              aplicador.
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              <LabelNip color={ui.text} fontSize={13} fontWeight="700" />
              <View style={styles.nipRow}>
                <TextInput
                  value={nip}
                  onChangeText={onChangeNip}
                  placeholder="00.0000.00"
                  placeholderTextColor={ui.placeholder}
                  style={[
                    styles.input,
                    styles.nipInput,
                    { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg },
                  ]}
                  keyboardType="numeric"
                  autoCorrect={false}
                  editable={!salvando}
                  onSubmitEditing={buscarMilitar}
                />
                <TouchableOpacity
                  onPress={buscarMilitar}
                  style={[styles.btnBuscar, { backgroundColor: theme.primary }]}
                  accessibilityLabel="Buscar militar pelo NIP"
                  disabled={salvando}
                >
                  <Search size={18} color={theme.tokens.textOnPrimary} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>
                Nome
              </Text>
              <TextInput
                value={cadastro?.nome?.trim() ?? ''}
                placeholder="Nome do militar (preenchido pelo NIP)"
                placeholderTextColor={ui.placeholder}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: ui.text,
                    backgroundColor: theme.cardBg,
                    opacity: cadastro ? 1 : 0.75,
                  },
                ]}
                editable={false}
                selectTextOnFocus={false}
              />
              {avisoBusca ? (
                <Text style={[theme.textStyles.caption, { color: theme.loss, marginBottom: 8 }]}>
                  {avisoBusca}
                </Text>
              ) : null}

              <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>
                Corrida (MM:SS)
              </Text>
              <TextInput
                value={tempoCorrida}
                onChangeText={(t) => {
                  setErro('');
                  setTempoCorrida(formatMinutosSegundosInput(t));
                }}
                placeholder="MM:SS"
                placeholderTextColor={ui.placeholder}
                style={[
                  styles.input,
                  { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg },
                ]}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                maxLength={5}
                editable={!salvando && !!cadastro}
              />

              <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>
                Natação (MM:SS)
              </Text>
              <TextInput
                value={tempoNatacao}
                onChangeText={(t) => {
                  setErro('');
                  setTempoNatacao(formatMinutosSegundosInput(t));
                }}
                placeholder="MM:SS"
                placeholderTextColor={ui.placeholder}
                style={[
                  styles.input,
                  { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg },
                ]}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                maxLength={5}
                editable={!salvando && !!cadastro}
              />

              <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>
                Permanência
              </Text>
              {(['aprovado', 'reprovado'] as const).map((opcao) => {
                const active = permanencia === opcao;
                return (
                  <TouchableOpacity
                    key={opcao}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      if (!cadastro || salvando) return;
                      setErro('');
                      setPermanencia(active ? null : opcao);
                    }}
                    style={styles.checkRow}
                    activeOpacity={0.85}
                    disabled={!cadastro || salvando}
                  >
                    <View style={[styles.checkBox, active ? styles.checkOn : styles.checkOff]}>
                      {active ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                    <Text style={[theme.textStyles.body, { color: ui.text }]}>
                      {opcao === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {erro ? (
                <Text style={[theme.textStyles.caption, styles.erro, { color: theme.loss }]}>
                  {erro}
                </Text>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={fechar}
                style={[styles.btn, styles.btnCancel, { borderColor: theme.border }]}
                disabled={salvando}
              >
                <Text style={[theme.textStyles.caption, { color: ui.text, fontWeight: '700' }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={irParaRubricaMilitar}
                style={[styles.btn, styles.btnSave, { backgroundColor: theme.primary }]}
                disabled={salvando || !cadastro}
              >
                {salvando ? (
                  <ActivityIndicator color={theme.tokens.textOnPrimary} size="small" />
                ) : (
                  <Text
                    style={[
                      theme.textStyles.caption,
                      { color: theme.tokens.textOnPrimary, fontWeight: '800' },
                    ]}
                  >
                    Continuar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppModal>

      <RubricaCaptureModal
        visible={visible && etapa === 'rubricaMilitar'}
        participante={participanteRubrica}
        indice={0}
        total={1}
        tipoProva="corrida"
        ultimo={false}
        onConfirm={onRubricaMilitar}
        onSkip={() =>
          Alert.alert('Rúbrica obrigatória', 'Desenhe a rúbrica do militar para continuar.')
        }
        onCancel={() => {
          setEtapa('form');
          setErro('');
        }}
      />

      <FluxoAssinaturaAplicadorModal
        visible={visible && etapa === 'aplicador'}
        onConcluir={(assinatura) => void concluirComAplicador(assinatura)}
        onCancelar={() => {
          if (salvando) return;
          setEtapa('form');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  closeBtn: { padding: 4 },
  subtitle: { marginBottom: 6 },
  hint: { marginBottom: 12, lineHeight: 18 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  fieldLabel: {
    marginBottom: 6,
    marginTop: 4,
  },
  nipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  nipInput: {
    flex: 1,
    marginBottom: 0,
  },
  btnBuscar: {
    width: 46,
    height: 46,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkOn: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkOff: {
    backgroundColor: 'transparent',
    borderColor: '#94A3B8',
  },
  erro: {
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnCancel: { borderWidth: 1 },
  btnSave: {},
});
