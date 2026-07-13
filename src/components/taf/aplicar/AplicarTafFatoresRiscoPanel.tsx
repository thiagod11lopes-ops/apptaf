import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { getAllCadastros, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import {
  FATORES_RISCO_ITENS,
  getFatoresRiscoByNip,
  listarFatoresRiscoSim,
  respostasFatoresVazias,
  saveFatoresRisco,
  type FatorRiscoId,
  type FatoresRiscoRegistro,
  type RespostaFatorRisco,
  type RespostasFatoresRisco,
} from '../../../services/fatoresRiscoStorage';
import { calcularImc, formatDecimalInput } from '../../../utils/imcFatoresRisco';
import { buscarCadastroPorNomeOuNip } from '../../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../../utils/nipFormat';
import { getAplicarTafGlass } from './aplicarTafTheme';
import {
  AplicarTafBackLink,
  AplicarTafGlassPanel,
  AplicarTafInput,
  AplicarTafPrimaryButton,
  AplicarTafSectionHeader,
} from './AplicarTafUi';
import { FatoresRiscoSalvoToast } from './FatoresRiscoSalvoToast';

type Props = {
  onVoltar: () => void;
  onSalvo?: () => void;
};

function SimNaoToggle({
  value,
  onChange,
  label,
}: {
  value: RespostaFatorRisco;
  onChange: (v: 'sim' | 'nao') => void;
  label: string;
}) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  return (
    <View style={styles.toggleRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {(['sim', 'nao'] as const).map((opcao) => {
        const active = value === opcao;
        return (
          <TouchableOpacity
            key={opcao}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}: ${opcao === 'sim' ? 'Sim' : 'Não'}`}
            activeOpacity={0.85}
            onPress={() => onChange(opcao)}
            style={[
              styles.toggleBtn,
              {
                borderColor: active ? theme.primary : glass.border,
                backgroundColor: active
                  ? theme.isDark
                    ? 'rgba(37,99,235,0.28)'
                    : 'rgba(37,99,235,0.12)'
                  : theme.isDark
                    ? 'rgba(2,6,23,0.35)'
                    : 'rgba(255,255,255,0.55)',
              },
            ]}
          >
            <Text style={[styles.toggleBtnText, { color: active ? theme.primary : ui.text }]}>
              {opcao === 'sim' ? 'Sim' : 'Não'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function AplicarTafFatoresRiscoPanel({ onVoltar, onSalvo }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<RespostasFatoresRisco>(respostasFatoresVazias);
  const [usoRemedios, setUsoRemedios] = useState('');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [toastSalvoVisible, setToastSalvoVisible] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [editandoExistente, setEditandoExistente] = useState(false);

  const imcResultado = useMemo(() => calcularImc(altura, peso), [altura, peso]);

  useEffect(() => {
    void getAllCadastros()
      .then(setCadastros)
      .catch(() => setCadastros([]));
  }, []);

  const limparAntropometria = useCallback(() => {
    setAltura('');
    setPeso('');
  }, []);

  const aplicarRegistroNoFormulario = useCallback((reg: FatoresRiscoRegistro) => {
    setNip(formatNipInput(reg.nip));
    setNome(reg.nome?.trim() || '');
    setRespostas({ ...respostasFatoresVazias(), ...reg.respostas });
    setUsoRemedios(reg.usoRemedios ?? '');
    setAltura(reg.altura ?? '');
    setPeso(reg.peso ?? '');
    setErroSalvar(null);
    setEditandoExistente(true);
    const sims = listarFatoresRiscoSim(reg.respostas);
    setFeedback(
      sims.length > 0
        ? `Editando cadastro existente (${sims.length} fator(es) com Sim). Altere e confirme para atualizar.`
        : 'Editando cadastro existente. Altere e confirme para atualizar.',
    );
  }, []);

  const carregarRespostasSalvas = useCallback(async (nipValor: string) => {
    const key = nipDigitos(nipValor);
    if (key.length !== 8) return;
    try {
      const reg = await getFatoresRiscoByNip(key);
      if (reg) {
        aplicarRegistroNoFormulario(reg);
      } else {
        setRespostas(respostasFatoresVazias());
        setUsoRemedios('');
        setAltura('');
        setPeso('');
        setEditandoExistente(false);
      }
    } catch {
      // silencioso
    }
  }, [aplicarRegistroNoFormulario]);

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        setFeedback(null);
        setRespostas(respostasFatoresVazias());
        setUsoRemedios('');
        limparAntropometria();
        setEditandoExistente(false);
        return;
      }

      const resultado = buscarCadastroPorNomeOuNip(cadastros, valor);
      if (resultado.kind === 'found') {
        const nipFmt = formatNipInput(resultado.cadastro.nip ?? '');
        if (origem === 'nip') {
          setNome(resultado.cadastro.nome?.trim() ?? '');
        } else {
          setNip(nipFmt);
        }
        setFeedback('Militar cadastrado no sistema.');
        void carregarRespostasSalvas(nipFmt);
        return;
      }

      if (resultado.kind === 'ambiguous') {
        setFeedback(
          origem === 'nome'
            ? 'Vários cadastros correspondem ao nome. Informe o NIP completo.'
            : 'Vários cadastros com este NIP. Verifique o cadastro.',
        );
        return;
      }

      const digitos = valor.replace(/\D/g, '');
      if (origem === 'nip') {
        if (digitos.length === 8) {
          setFeedback('NIP não encontrado no cadastro.');
          setNome('');
          setRespostas(respostasFatoresVazias());
          setUsoRemedios('');
          limparAntropometria();
          setEditandoExistente(false);
        } else {
          setNome('');
          setFeedback(null);
        }
      } else if (origem === 'nome' && v.length >= 3) {
        setFeedback('Nome não encontrado no cadastro.');
        setNip('');
        setRespostas(respostasFatoresVazias());
        setUsoRemedios('');
        limparAntropometria();
        setEditandoExistente(false);
      } else {
        setFeedback(null);
      }
    },
    [cadastros, carregarRespostasSalvas, limparAntropometria],
  );

  const onChangeNip = useCallback(
    (texto: string) => {
      const formatado = formatNipInput(texto);
      setNip(formatado);
      sincronizarCampoPar('nip', formatado);
    },
    [sincronizarCampoPar],
  );

  const onChangeNome = useCallback(
    (texto: string) => {
      setNome(texto);
      sincronizarCampoPar('nome', texto);
    },
    [sincronizarCampoPar],
  );

  const setResposta = useCallback((id: FatorRiscoId, valor: 'sim' | 'nao') => {
    setErroSalvar(null);
    setRespostas((prev) => ({
      ...prev,
      [id]: prev[id] === valor ? null : valor,
    }));
  }, []);

  const salvar = useCallback(async () => {
    setErroSalvar(null);
    const digitos = nipDigitos(nip);
    if (digitos.length !== 8) {
      setErroSalvar('Informe um NIP válido (8 dígitos) antes de salvar.');
      return;
    }
    if (!nome.trim()) {
      setErroSalvar('Informe o nome do militar antes de salvar.');
      return;
    }
    const pendente = FATORES_RISCO_ITENS.some((item) => respostas[item.id] == null);
    if (pendente) {
      setErroSalvar('Marque Sim ou Não para todos os fatores de risco antes de confirmar.');
      return;
    }

    setSalvando(true);
    try {
      await saveFatoresRisco({
        nip,
        nome,
        respostas,
        usoRemedios: usoRemedios.trim() || undefined,
        altura: altura.trim() || undefined,
        peso: peso.trim() || undefined,
        imc: imcResultado?.imc,
      });
      onSalvo?.();
      setToastSalvoVisible(true);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Não foi possível salvar os fatores de risco. Tente novamente.';
      setErroSalvar(msg);
    } finally {
      setSalvando(false);
    }
  }, [nip, nome, respostas, usoRemedios, altura, peso, imcResultado, onSalvo]);

  const fecharToastEVoltar = useCallback(() => {
    setToastSalvoVisible(false);
    onVoltar();
  }, [onVoltar]);

  return (
    <>
    <AplicarTafGlassPanel accent="violet">
      <AplicarTafBackLink label="Voltar ao início" onPress={onVoltar} />
      <AplicarTafSectionHeader
        kicker="SAÚDE"
        title="Fatores de Risco"
        subtitle="Informe o NIP ou o nome do militar. O outro campo será preenchido automaticamente."
      />

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={[ts.caption, styles.label, { color: theme.textMuted }]}>NIP</Text>
          <AplicarTafInput
            value={nip}
            onChangeText={onChangeNip}
            placeholder="00.0000.00"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="NIP do militar"
          />
        </View>

        <View style={styles.field}>
          <Text style={[ts.caption, styles.label, { color: theme.textMuted }]}>Nome</Text>
          <AplicarTafInput
            value={nome}
            onChangeText={onChangeNome}
            placeholder="Nome completo do militar"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Nome do militar"
          />
        </View>
      </View>

      {feedback ? (
        <Text
          style={[
            ts.caption,
            styles.feedback,
            {
              color: feedback.includes('cadastrado')
                ? theme.gain
                : feedback.includes('não encontrado') || feedback.includes('Vários')
                  ? theme.loss
                  : theme.textSecondary,
            },
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      <View style={styles.checklistBlock}>
        <Text style={[ts.caption, styles.checklistTitle, { color: theme.textMuted }]}>
          Checklist de fatores de risco
        </Text>
        <Text style={[ts.caption, styles.checklistHint, { color: theme.textSecondary }]}>
          Marque Sim ou Não para cada item.
        </Text>

        <View style={styles.checklistList}>
          {FATORES_RISCO_ITENS.map((fator) => (
            <View
              key={fator.id}
              style={[
                styles.checklistItem,
                {
                  borderColor: glass.border,
                  backgroundColor: theme.isDark ? 'rgba(2,6,23,0.28)' : 'rgba(255,255,255,0.4)',
                },
              ]}
            >
              <Text style={[styles.checklistLabel, { color: ui.text }]}>{fator.label}</Text>
              <SimNaoToggle
                label={fator.label}
                value={respostas[fator.id]}
                onChange={(v) => setResposta(fator.id, v)}
              />
            </View>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={[ts.caption, styles.label, { color: theme.textMuted }]}>Uso de remédios</Text>
          <AplicarTafInput
            value={usoRemedios}
            onChangeText={setUsoRemedios}
            placeholder="Ex.: Losartana, Metformina…"
            autoCapitalize="sentences"
            autoCorrect
            multiline
            accessibilityLabel="Uso de remédios"
            style={styles.remediosInput}
          />
          <Text style={[ts.caption, { color: theme.textSecondary }]}>
            Informe os nomes dos medicamentos em uso, se houver.
          </Text>
        </View>
      </View>

      <View style={styles.imcBlock}>
        <Text style={[ts.caption, styles.checklistTitle, { color: theme.textMuted }]}>
          Antropometria / IMC
        </Text>
        <Text style={[ts.caption, styles.checklistHint, { color: theme.textSecondary }]}>
          Informe a altura (m ou cm) e o peso (kg). O IMC é calculado automaticamente.
        </Text>

        <View style={styles.imcFieldsRow}>
          <View style={[styles.field, styles.imcField]}>
            <Text style={[ts.caption, styles.label, { color: theme.textMuted }]}>Altura</Text>
            <AplicarTafInput
              value={altura}
              onChangeText={(t) => setAltura(formatDecimalInput(t))}
              placeholder="1,75 ou 175"
              keyboardType="decimal-pad"
              inputMode="decimal"
              accessibilityLabel="Altura do militar"
            />
          </View>
          <View style={[styles.field, styles.imcField]}>
            <Text style={[ts.caption, styles.label, { color: theme.textMuted }]}>Peso (kg)</Text>
            <AplicarTafInput
              value={peso}
              onChangeText={(t) => setPeso(formatDecimalInput(t))}
              placeholder="75,5"
              keyboardType="decimal-pad"
              inputMode="decimal"
              accessibilityLabel="Peso do militar"
            />
          </View>
        </View>

        {imcResultado ? (
          <View
            style={[
              styles.imcResultCard,
              {
                borderColor: imcResultado.classificacao.corHex,
                backgroundColor: theme.isDark
                  ? `${imcResultado.classificacao.corHex}22`
                  : `${imcResultado.classificacao.corHex}14`,
              },
            ]}
          >
            <Text style={[styles.imcValue, { color: imcResultado.classificacao.corHex }]}>
              IMC {imcResultado.imcFormatado}
            </Text>
            <Text style={[styles.imcTitulo, { color: imcResultado.classificacao.corHex }]}>
              {imcResultado.classificacao.titulo}
            </Text>
            <Text style={[ts.caption, styles.imcFaixa, { color: theme.textSecondary }]}>
              {imcResultado.classificacao.faixa}
            </Text>
            <Text style={[ts.caption, { color: ui.text, lineHeight: 18 }]}>
              {imcResultado.classificacao.descricao}
            </Text>
          </View>
        ) : altura.trim() || peso.trim() ? (
          <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
            Preencha altura e peso válidos para calcular o IMC.
          </Text>
        ) : null}
      </View>

      <View style={styles.saveWrap}>
        {erroSalvar ? (
          <Text style={[ts.caption, styles.erroSalvar, { color: theme.loss }]}>{erroSalvar}</Text>
        ) : null}
        <AplicarTafPrimaryButton
          label={
            salvando
              ? 'Salvando…'
              : editandoExistente
                ? 'OK — Atualizar fatores'
                : 'OK — Confirmar fatores'
          }
          onPress={() => void salvar()}
          loading={salvando}
          disabled={salvando || toastSalvoVisible}
        />
      </View>
    </AplicarTafGlassPanel>
    <FatoresRiscoSalvoToast
      visible={toastSalvoVisible}
      durationMs={3000}
      onDone={fecharToastEVoltar}
    />
    </>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 14,
    marginTop: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  feedback: {
    marginTop: 12,
    fontWeight: '600',
  },
  checklistBlock: {
    marginTop: 20,
    gap: 8,
  },
  checklistTitle: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  checklistHint: {
    marginBottom: 4,
  },
  checklistList: {
    gap: 10,
  },
  remediosInput: {
    minHeight: 72,
    textAlignVertical: 'top' as const,
    paddingTop: 12,
  },
  checklistItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  checklistLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  imcBlock: {
    marginTop: 20,
    gap: 8,
  },
  imcFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imcField: {
    flex: 1,
  },
  imcResultCard: {
    marginTop: 6,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  imcValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  imcTitulo: {
    fontSize: 16,
    fontWeight: '800',
  },
  imcFaixa: {
    marginBottom: 2,
  },
  saveWrap: {
    marginTop: 18,
    gap: 10,
  },
  erroSalvar: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
