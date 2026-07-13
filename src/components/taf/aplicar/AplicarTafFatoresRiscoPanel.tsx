import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getAllCadastros, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from '../../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput } from '../../../utils/nipFormat';
import {
  AplicarTafBackLink,
  AplicarTafGlassPanel,
  AplicarTafInput,
  AplicarTafSectionHeader,
} from './AplicarTafUi';

type Props = {
  onVoltar: () => void;
};

export function AplicarTafFatoresRiscoPanel({ onVoltar }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void getAllCadastros()
      .then(setCadastros)
      .catch(() => setCadastros([]));
  }, []);

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        setFeedback(null);
        return;
      }

      const resultado = buscarCadastroPorNomeOuNip(cadastros, valor);
      if (resultado.kind === 'found') {
        if (origem === 'nip') {
          setNome(resultado.cadastro.nome?.trim() ?? '');
        } else {
          setNip(formatNipInput(resultado.cadastro.nip ?? ''));
        }
        setFeedback('Militar cadastrado no sistema.');
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
        } else {
          // NIP incompleto: não mantém nome de uma busca anterior.
          setNome('');
          setFeedback(null);
        }
      } else if (origem === 'nome' && v.length >= 3) {
        setFeedback('Nome não encontrado no cadastro.');
        setNip('');
      } else {
        setFeedback(null);
      }
    },
    [cadastros],
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
});
