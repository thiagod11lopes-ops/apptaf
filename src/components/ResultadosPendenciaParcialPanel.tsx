import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import type { PendenciaParcialItem } from '../utils/resultadoTafCadastro';
import { listarPendenciasParciaisFromHistorico } from '../utils/resultadoGeralHistorico';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

function ChipModalidade({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  return (
    <View
      style={[
        styles.chip,
        ok
          ? { backgroundColor: theme.gainMuted, borderColor: theme.gain }
          : { backgroundColor: theme.lossMuted, borderColor: theme.loss },
      ]}
    >
      <Text
        style={[
          ts.caption,
          { color: ok ? theme.gain : theme.loss, fontWeight: '700', fontSize: 11 },
        ]}
      >
        {label} {ok ? '✓' : '—'}
      </Text>
    </View>
  );
}

export function ResultadosPendenciaParcialPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [lista, setLista] = useState<PendenciaParcialItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([getAllCadastros(), getAllSessoesAplicacao()])
      .then(([cadastros, sessoes]) =>
        setLista(listarPendenciasParciaisFromHistorico(sessoes, cadastros)),
      )
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Militares com pelo menos uma prova registrada (Aplicar TAF ou Registrador de TAF), mas sem
        as três modalidades (corrida, natação e permanência).
      </Text>

      {carregando ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : null}

      {!carregando && lista.length === 0 ? (
        <Card elevated style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhuma pendência parcial no momento.
          </Text>
          <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
            Não há militares com pendência no histórico, ou ainda não existem sessões registradas.
          </Text>
        </Card>
      ) : null}

      {!carregando && lista.length > 0 ? (
        <Text style={[ts.caption, styles.contador, { color: theme.textMuted }]}>
          {lista.length} militar{lista.length !== 1 ? 'es' : ''} com pendência
        </Text>
      ) : null}

      {lista.map((item) => (
        <Card key={item.id} elevated style={styles.itemCard}>
          <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
          <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{item.nip}</Text>
          <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
          <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 10 }]}>
            {item.nome}
          </Text>

          <View style={styles.chipsRow}>
            <ChipModalidade label="Corrida" ok={item.temCorrida} />
            <ChipModalidade label="Natação" ok={item.temNatacao} />
            <ChipModalidade label="Permanência" ok={item.temPermanencia} />
          </View>

          <Text style={[ts.caption, styles.faltaLabel, { color: theme.loss }]}>
            Falta: {item.faltam.join(', ')}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { marginBottom: 14, lineHeight: 20 },
  loader: { marginVertical: 24 },
  emptyCard: { padding: 20 },
  emptyHint: { marginTop: 8, lineHeight: 18 },
  contador: { marginBottom: 10, textAlign: 'center' },
  itemCard: { padding: 16, marginBottom: 12 },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  faltaLabel: {
    fontWeight: '700',
    lineHeight: 18,
  },
});
