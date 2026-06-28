import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { RubricaCaptureModal } from '../components/RubricaCaptureModal';
import { LabelNip } from '../components/LabelNip';
import { useTheme } from '../contexts/ThemeContext';
import { getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { tituloTipoProva } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality, parseTafPerformanceInput } from '../taf/tafTimeFormat';
import {
  notaCorridaParaPersistencia,
  textoNotaCorridaFromCadastro,
} from '../taf/corrida2400Nota';
import {
  notaNatacaoParaPersistencia,
  textoNotaNatacaoFromCadastro,
} from '../taf/natacaoNota';
import {
  notaCaminhadaParaPersistencia,
  textoNotaCaminhadaFromCadastro,
} from '../taf/caminhada4800Nota';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from '../utils/exportResultadosTafPdf';
import { dataHojeBr } from '../utils/tafRegistro';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

const TIPOS: TipoProvaAplicada[] = ['corrida', 'natacao', 'permanencia', 'caminhada'];
const PERMANENCIA_TEMPO_MS = 10 * 60 * 1000;

function situacaoFromNota(nota?: string | null): string | undefined {
  const t = (nota ?? '').trim();
  if (!t || t === '—') return undefined;
  if (t === 'REPROVADO') return 'Reprovado';
  return 'Aprovado';
}

function tempoTextoInicial(tipo: TipoProvaAplicada, tempoMs: number): string {
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  return tempoTextoFromMs(tipo, tempoMs);
}

function notaPatchFromTempo(
  tipo: TipoProvaAplicada,
  tempoTexto: string,
  nip: string,
  nome: string,
  cadastros: CadastroItemPersist[],
): Partial<ResultadoCorridaItem> {
  if (tipo === 'permanencia') return {};
  const tempo = tempoTexto.trim();
  if (!tempo) {
    return { notaTexto: '', reprovacaoTexto: '' };
  }

  const busca = buscarCadastroPorNomeOuNip(cadastros, nip.trim() || nome.trim());
  if (busca.kind !== 'found') {
    return { notaTexto: '—', reprovacaoTexto: undefined };
  }

  const { dataNascimento, sexo } = busca.cadastro;
  if (tipo === 'corrida') {
    const notaRaw = textoNotaCorridaFromCadastro({
      tempoCorrida: tempo,
      dataNascimento,
      sexo,
    });
    const notaTexto = notaCorridaParaPersistencia(notaRaw) ?? (notaRaw === '—' ? '—' : undefined);
    return {
      notaTexto: notaTexto ?? '—',
      reprovacaoTexto: situacaoFromNota(notaTexto ?? notaRaw),
    };
  }

  if (tipo === 'caminhada') {
    const notaRaw = textoNotaCaminhadaFromCadastro({
      tempoCaminhada: tempo,
      dataNascimento,
      sexo,
    });
    const notaTexto = notaCaminhadaParaPersistencia(notaRaw) ?? (notaRaw === '—' ? '—' : undefined);
    return {
      notaTexto: notaTexto ?? '—',
      reprovacaoTexto: situacaoFromNota(notaTexto ?? notaRaw),
    };
  }

  const notaRaw = textoNotaNatacaoFromCadastro({
    tempoNatacao: tempo,
    dataNascimento,
    sexo,
  });
  const notaTexto = notaNatacaoParaPersistencia(notaRaw) ?? (notaRaw === '—' ? '—' : undefined);
  return {
    notaTexto: notaTexto ?? '—',
    reprovacaoTexto: situacaoFromNota(notaTexto ?? notaRaw),
  };
}

function novoParticipante(tipo: TipoProvaAplicada, indice: number): ResultadoCorridaItem {
  return {
    corredor: indice + 1,
    nome: '',
    nip: '',
    tempoMs: 0,
    prova: tipo,
    notaTexto: '',
    reprovacaoTexto: '',
  };
}

function tempoTextoFromMs(tipo: TipoProvaAplicada, ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, ms);
}

function msFromTempoTexto(tipo: TipoProvaAplicada, texto: string): number {
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  const ms = parseTafPerformanceInput(mod, texto);
  return ms ?? 0;
}

export type SessaoDraft = {
  id?: string;
  criadoEm?: string;
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  resultados: ResultadoCorridaItem[];
};

type Props = {
  initial?: SessaoAplicacaoTaf | null;
  onSave: (draft: SessaoDraft) => Promise<void>;
  onCancel: () => void;
};

export function SessaoHistoricoEditor({ initial, onSave, onCancel }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [salvando, setSalvando] = useState(false);
  const [dataAplicacao, setDataAplicacao] = useState(initial?.dataAplicacao ?? dataHojeBr());
  const [tipoProva, setTipoProva] = useState<TipoProvaAplicada>(initial?.tipoProva ?? 'corrida');
  const [resultados, setResultados] = useState<ResultadoCorridaItem[]>(
    initial?.resultados?.length
      ? initial.resultados.map((r) => ({ ...r, prova: r.prova ?? initial.tipoProva }))
      : [],
  );
  const [temposTexto, setTemposTexto] = useState<string[]>(() =>
    (initial?.resultados ?? []).map((r) =>
      tempoTextoInicial(initial?.tipoProva ?? 'corrida', r.tempoMs),
    ),
  );
  const [rubricaWizard, setRubricaWizard] = useState<{
    lista: ResultadoCorridaItem[];
    indice: number;
  } | null>(null);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);

  useEffect(() => {
    void getAllCadastros().then(setCadastros);
  }, []);

  const inputStyle = useMemo(
    () => [
      styles.input,
      { color: ui.text, borderColor: theme.border, backgroundColor: ui.inputBg },
      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
    ],
    [ui, theme.border],
  );

  const syncTemposLength = useCallback(
    (lista: ResultadoCorridaItem[], tipo: TipoProvaAplicada) => {
      setTemposTexto((prev) => {
        const next = [...prev];
        while (next.length < lista.length) {
          next.push(tipo === 'permanencia' ? PERMANENCIA_TEMPO_PDF_PADRAO : '');
        }
        return next.slice(0, lista.length);
      });
    },
    [],
  );

  const alterarTipo = useCallback(
    (tipo: TipoProvaAplicada) => {
      setTipoProva(tipo);
      setResultados((prev) => prev.map((r) => ({ ...r, prova: tipo })));
      if (tipo === 'permanencia') {
        setTemposTexto((prev) => prev.map(() => PERMANENCIA_TEMPO_PDF_PADRAO));
      } else {
        setTemposTexto((prev) =>
          prev.map((t) => (t === PERMANENCIA_TEMPO_PDF_PADRAO ? '' : t)),
        );
      }
    },
    [],
  );

  const adicionarParticipante = useCallback(() => {
    setResultados((prev) => {
      const next = [...prev, novoParticipante(tipoProva, prev.length)];
      syncTemposLength(next, tipoProva);
      return next;
    });
  }, [tipoProva, syncTemposLength]);

  const removerParticipante = useCallback(
    (index: number) => {
      setResultados((prev) => {
        const next = prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, corredor: i + 1 }));
        syncTemposLength(next, tipoProva);
        return next;
      });
      setTemposTexto((prev) => prev.filter((_, i) => i !== index));
    },
    [syncTemposLength, tipoProva],
  );

  const atualizarCampo = useCallback(
    (index: number, patch: Partial<ResultadoCorridaItem>) => {
      setResultados((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    },
    [],
  );

  const onChangeNip = useCallback(
    (index: number, texto: string) => {
      const formatado = formatNipInput(texto);
      setResultados((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          if (!formatado.trim()) {
            return { ...r, nip: '', nome: '', notaTexto: '', reprovacaoTexto: '' };
          }
          const busca = buscarCadastroPorNomeOuNip(cadastros, formatado);
          const base =
            busca.kind === 'found'
              ? {
                  nip: formatado,
                  nome: (busca.cadastro.nome ?? '').trim(),
                }
              : { nip: formatado };
          const tempo = temposTexto[index] ?? '';
          return {
            ...r,
            ...base,
            ...notaPatchFromTempo(tipoProva, tempo, base.nip ?? formatado, base.nome ?? r.nome, cadastros),
          };
        }),
      );
    },
    [cadastros, temposTexto, tipoProva],
  );

  const onChangeNome = useCallback(
    (index: number, texto: string) => {
      setResultados((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          if (!texto.trim()) {
            return { ...r, nome: '', nip: '', notaTexto: '', reprovacaoTexto: '' };
          }
          const busca = buscarCadastroPorNomeOuNip(cadastros, texto);
          const base =
            busca.kind === 'found'
              ? {
                  nome: texto,
                  nip: formatNipInput(busca.cadastro.nip ?? ''),
                }
              : { nome: texto };
          const tempo = temposTexto[index] ?? '';
          return {
            ...r,
            ...base,
            ...notaPatchFromTempo(
              tipoProva,
              tempo,
              base.nip ?? r.nip,
              base.nome ?? texto,
              cadastros,
            ),
          };
        }),
      );
    },
    [cadastros, temposTexto, tipoProva],
  );

  const onChangeTempo = useCallback(
    (index: number, texto: string) => {
      if (tipoProva === 'permanencia') return;
      setTemposTexto((prev) => {
        const next = [...prev];
        next[index] = texto;
        return next;
      });
      setResultados((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          return {
            ...r,
            ...notaPatchFromTempo(tipoProva, texto, r.nip ?? '', r.nome ?? '', cadastros),
          };
        }),
      );
    },
    [cadastros, tipoProva],
  );

  const avisosCadastro = useMemo(() => {
    return resultados.map((r) => {
      const digits = nipDigitos(r.nip);
      const nome = (r.nome ?? '').trim();
      const podeValidar = digits.length >= 8 || nome.length >= 3;
      if (!podeValidar) return null;

      const porNip = digits.length > 0 ? buscarCadastroPorNomeOuNip(cadastros, r.nip) : { kind: 'none' as const };
      if (porNip.kind === 'found') return null;
      if (porNip.kind === 'ambiguous') {
        return 'Vários cadastros correspondem ao NIP informado.';
      }

      const porNome = nome.length >= 2 ? buscarCadastroPorNomeOuNip(cadastros, nome) : { kind: 'none' as const };
      if (porNome.kind === 'found') return null;
      if (porNome.kind === 'ambiguous') {
        return 'Vários cadastros correspondem ao nome informado.';
      }

      return 'NIP e nome não encontrados no cadastro do sistema.';
    });
  }, [resultados, cadastros]);

  const montarListaParaSalvar = useCallback((): ResultadoCorridaItem[] => {
    return resultados.map((r, i) => ({
      ...r,
      prova: tipoProva,
      tempoMs:
        tipoProva === 'permanencia'
          ? PERMANENCIA_TEMPO_MS
          : msFromTempoTexto(tipoProva, temposTexto[i] ?? ''),
      corredor: i + 1,
      nome: (r.nome ?? '').trim(),
      nip: (r.nip ?? '').trim(),
      notaTexto: (r.notaTexto ?? '').trim() || undefined,
      reprovacaoTexto: (r.reprovacaoTexto ?? '').trim() || undefined,
    }));
  }, [resultados, temposTexto, tipoProva]);

  const concluirSalvar = useCallback(
    async (lista: ResultadoCorridaItem[]) => {
      setSalvando(true);
      try {
        await onSave({
          id: initial?.id,
          criadoEm: initial?.criadoEm,
          dataAplicacao: dataAplicacao.trim(),
          tipoProva,
          resultados: lista,
        });
      } finally {
        setSalvando(false);
      }
    },
    [dataAplicacao, tipoProva, initial, onSave],
  );

  const proximoIndiceRubrica = useCallback((lista: ResultadoCorridaItem[], desde: number) => {
    for (let i = desde; i < lista.length; i += 1) {
      if (!lista[i].rubricaCandidatoSvg?.trim()) return i;
    }
    return lista.length;
  }, []);

  const iniciarFluxoRubrica = useCallback(
    (lista: ResultadoCorridaItem[]) => {
      const primeiro = proximoIndiceRubrica(lista, 0);
      if (primeiro >= lista.length) {
        void concluirSalvar(lista);
        return;
      }
      setRubricaWizard({ lista, indice: primeiro });
    },
    [concluirSalvar, proximoIndiceRubrica],
  );

  const salvar = useCallback(() => {
    const data = dataAplicacao.trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.');
      return;
    }

    const lista = montarListaParaSalvar();
    if (lista.length === 0) {
      void concluirSalvar(lista);
      return;
    }
    iniciarFluxoRubrica(lista);
  }, [dataAplicacao, montarListaParaSalvar, concluirSalvar, iniciarFluxoRubrica]);

  const avancarRubrica = useCallback(
    (lista: ResultadoCorridaItem[], indiceAtual: number) => {
      const prox = proximoIndiceRubrica(lista, indiceAtual + 1);
      if (prox >= lista.length) {
        setRubricaWizard(null);
        void concluirSalvar(lista);
      } else {
        setRubricaWizard({ lista, indice: prox });
      }
    },
    [concluirSalvar, proximoIndiceRubrica],
  );

  const onRubricaConfirm = useCallback(
    (svg: string) => {
      if (!rubricaWizard) return;
      const lista = [...rubricaWizard.lista];
      const i = rubricaWizard.indice;
      lista[i] = {
        ...lista[i],
        rubricaCandidato: 'Rúbrica capturada',
        rubricaCandidatoSvg: svg,
      };
      avancarRubrica(lista, i);
    },
    [rubricaWizard, avancarRubrica],
  );

  const onRubricaSkip = useCallback(() => {
    if (!rubricaWizard) return;
    avancarRubrica(rubricaWizard.lista, rubricaWizard.indice);
  }, [rubricaWizard, avancarRubrica]);

  const participanteRubrica = rubricaWizard?.lista[rubricaWizard.indice] ?? null;

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]}>
        {initial ? 'Editar sessão' : 'Nova sessão no histórico'}
      </Text>

      <Text style={[styles.label, { color: theme.textMuted }]}>Data da aplicação</Text>
      <TextInput
        value={dataAplicacao}
        onChangeText={setDataAplicacao}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={ui.placeholder}
        style={inputStyle}
      />

      <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>Tipo de prova</Text>
      <View style={styles.tipoRow}>
        {TIPOS.map((t) => {
          const active = tipoProva === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => alterarTipo(t)}
              style={[
                styles.tipoBtn,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.accentMuted : ui.inputBg,
                },
              ]}
            >
              <Text style={{ color: active ? theme.primary : ui.text, fontWeight: '700', fontSize: 13 }}>
                {tituloTipoProva(t)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.participantesHeader}>
        <Text style={[styles.label, { color: theme.textMuted, marginTop: 0 }]}>
          Participantes ({resultados.length})
        </Text>
        <TouchableOpacity
          onPress={adicionarParticipante}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          accessibilityLabel="Adicionar participante"
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {resultados.length === 0 ? (
        <Text style={[styles.emptyPart, { color: theme.textMuted }]}>
          Nenhum participante. Adicione ao menos um ou salve a sessão vazia.
        </Text>
      ) : null}

      {resultados.map((r, index) => (
        <View
          key={`${initial?.id ?? 'new'}-${index}`}
          style={[styles.partCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <View style={styles.partCardTop}>
            <Text style={[styles.partIndex, { color: theme.primary }]}>#{r.corredor}</Text>
            <TouchableOpacity
              onPress={() => removerParticipante(index)}
              accessibilityLabel="Remover participante"
              style={[styles.removeBtn, { borderColor: theme.loss }]}
            >
              <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.nipField}>
            <LabelNip color={theme.textMuted} fontSize={11} fontWeight={600} />
            <TextInput
              value={r.nip}
              onChangeText={(t) => onChangeNip(index, t)}
              style={[inputStyle, styles.inputAfterLabel]}
              placeholder="00.0000.00"
              placeholderTextColor={ui.placeholder}
              keyboardType="numeric"
              autoCorrect={false}
            />
            {avisosCadastro[index] ? (
              <Text style={[styles.avisoCadastro, { color: theme.loss }]}>{avisosCadastro[index]}</Text>
            ) : null}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Nome</Text>
          <TextInput
            value={r.nome}
            onChangeText={(t) => onChangeNome(index, t)}
            style={inputStyle}
            placeholder="Nome completo"
            placeholderTextColor={ui.placeholder}
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
            Tempo {tipoProva === 'permanencia' ? '' : '(MM:SS)'}
          </Text>
          <TextInput
            value={
              tipoProva === 'permanencia'
                ? PERMANENCIA_TEMPO_PDF_PADRAO
                : (temposTexto[index] ?? '')
            }
            onChangeText={(t) => onChangeTempo(index, t)}
            style={[
              inputStyle,
              tipoProva === 'permanencia' ? styles.inputReadonly : null,
            ]}
            placeholder={tipoProva === 'permanencia' ? PERMANENCIA_TEMPO_PDF_PADRAO : '00:00'}
            placeholderTextColor={ui.placeholder}
            editable={tipoProva !== 'permanencia'}
          />

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Nota</Text>
          <TextInput
            value={r.notaTexto ?? ''}
            onChangeText={(t) => atualizarCampo(index, { notaTexto: t })}
            style={inputStyle}
            placeholder="100, REPROVADO…"
            placeholderTextColor={ui.placeholder}
          />

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Situação / reprovação</Text>
          <TextInput
            value={r.reprovacaoTexto ?? ''}
            onChangeText={(t) => atualizarCampo(index, { reprovacaoTexto: t })}
            style={inputStyle}
            placeholder="Aprovado, Reprovado…"
            placeholderTextColor={ui.placeholder}
          />
        </View>
      ))}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}
          disabled={salvando}
        >
          <Text style={{ color: ui.text, fontWeight: '700' }}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={salvar}
          style={[styles.btn, { backgroundColor: theme.primary }]}
          disabled={salvando || !!rubricaWizard}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {salvando ? 'Salvando…' : rubricaWizard ? 'Aguardando rúbrica…' : 'Salvar'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    <RubricaCaptureModal
      visible={!!rubricaWizard && !!participanteRubrica}
      participante={participanteRubrica}
      indice={rubricaWizard?.indice ?? 0}
      total={rubricaWizard?.lista.length ?? 0}
      tipoProva={tipoProva}
      ultimo={
        rubricaWizard != null &&
        proximoIndiceRubrica(rubricaWizard.lista, rubricaWizard.indice + 1) >= rubricaWizard.lista.length
      }
      onConfirm={onRubricaConfirm}
      onSkip={onRubricaSkip}
      onCancel={() => setRubricaWizard(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  nipField: { marginTop: 4 },
  inputAfterLabel: { marginTop: 4 },
  inputReadonly: { opacity: 0.85 },
  avisoCadastro: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  participantesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: PREMIUM.radiusMd,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  emptyPart: { fontSize: 13, marginBottom: 12 },
  partCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    marginBottom: 12,
  },
  partCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partIndex: { fontSize: 14, fontWeight: '800' },
  removeBtn: {
    padding: 8,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
