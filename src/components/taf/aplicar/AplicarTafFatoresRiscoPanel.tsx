import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { getAllCadastros, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import {
  FATORES_RISCO_ITENS,
  getFatoresRiscoByNip,
  respostasFatoresVazias,
  saveFatoresRisco,
  type FatorRiscoId,
  type RespostaFatorRisco,
  type RespostasFatoresRisco,
} from '../../../services/fatoresRiscoStorage';
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
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void getAllCadastros()
      .then(setCadastros)
      .catch(() => setCadastros([]));
  }, []);

  const carregarRespostasSalvas = useCallback(async (nipValor: string) => {
    const key = nipDigitos(nipValor);
    if (key.length !== 8) return;
    try {
      const reg = await getFatoresRiscoByNip(key);
      if (reg) {
        setRespostas({ ...respostasFatoresVazias(), ...reg.respostas });
      } else {
        setRespostas(respostasFatoresVazias());
      }
    } catch {
      // silencioso
    }
  }, []);

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        setFeedback(null);
        setRespostas(respostasFatoresVazias());
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
        } else {
          setNome('');
          setFeedback(null);
        }
      } else if (origem === 'nome' && v.length >= 3) {
        setFeedback('Nome não encontrado no cadastro.');
        setNip('');
        setRespostas(respostasFatoresVazias());
      } else {
        setFeedback(null);
      }
    },
    [cadastros, carregarRespostasSalvas],
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
    setRespostas((prev) => ({
      ...prev,
      [id]: prev[id] === valor ? null : valor,
    }));
  }, []);

  const salvar = useCallback(async () => {
    const digitos = nipDigitos(nip);
    if (digitos.length !== 8) {
      Alert.alert('NIP obrigatório', 'Informe um NIP válido (8 dígitos) antes de salvar.');
      return;
    }
    if (!nome.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do militar antes de salvar.');
      return;
    }
    const pendente = FATORES_RISCO_ITENS.some((item) => respostas[item.id] == null);
    if (pendente) {
      Alert.alert(
        'Checklist incompleto',
        'Marque Sim ou Não para todos os fatores de risco antes de confirmar.',
      );
      return;
    }

    setSalvando(true);
    try {
      await saveFatoresRisco({ nip, nome, respostas });
      onSalvo?.();
      Alert.alert('Salvo', 'Fatores de risco registrados para este militar.', [
        { text: 'OK', onPress: onVoltar },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar os fatores de risco. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }, [nip, nome, respostas, onSalvo, onVoltar]);

  return (
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
      </View>

      <View style={styles.saveWrap}>
        <AplicarTafPrimaryButton
          label={salvando ? 'Salvando…' : 'OK — Confirmar fatores'}
          onPress={() => void salvar()}
          loading={salvando}
          disabled={salvando}
        />
      </View>
    </AplicarTafGlassPanel>
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
  saveWrap: {
    marginTop: 18,
  },
});
