import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ArrowLeft, History, Trash2 } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import {
  excluirResultadoSubstituido,
  listarMilitaresComHistoricoSubstituido,
  listarResultadosSubstituidos,
  type MilitarComHistoricoSubstituido,
  type ResultadoSubstituidoRecord,
} from '../../services/resultadosSubstituidosStorage';
import { HistoricoSubstituidoStripe } from './HistoricoSubstituidoStripe';
import { ConfirmacaoExcluirHistoricoSubstituidoModal } from './ConfirmacaoExcluirHistoricoSubstituidoModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Se informado, abre direto no histórico desse militar. */
  foco?: { nip?: string; cadastroId?: string; nome?: string } | null;
};

const ORANGE_BG = '#fff7ed';
const ORANGE_BORDER = '#f97316';
const ORANGE_TEXT = '#9a3412';
const ORANGE_MUTED = '#c2410c';

function formatQuando(ts: number): string {
  try {
    return new Date(ts).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

export function HistoricoResultadosSubstituidosModal({ visible, onClose, foco = null }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const [carregando, setCarregando] = useState(false);
  const [militares, setMilitares] = useState<MilitarComHistoricoSubstituido[]>([]);
  const [detalhe, setDetalhe] = useState<MilitarComHistoricoSubstituido | null>(null);
  const [itensDetalhe, setItensDetalhe] = useState<ResultadoSubstituidoRecord[]>([]);
  const [excluindo, setExcluindo] = useState(false);
  const [itemParaExcluir, setItemParaExcluir] = useState<ResultadoSubstituidoRecord | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      if (foco?.nip || foco?.cadastroId) {
        const itens = await listarResultadosSubstituidos({
          nip: foco.nip,
          cadastroId: foco.cadastroId,
        });
        const militar: MilitarComHistoricoSubstituido = {
          key: foco.cadastroId || foco.nip || 'foco',
          nip: foco.nip || itens[0]?.nip || '—',
          nome: foco.nome || itens[0]?.nome || '—',
          postoGrad: itens[0]?.postoGrad,
          cadastroId: foco.cadastroId,
          total: itens.length,
          itens,
        };
        setMilitares(itens.length > 0 ? [militar] : []);
        setDetalhe(itens.length > 0 ? militar : null);
        setItensDetalhe(itens);
      } else {
        const lista = await listarMilitaresComHistoricoSubstituido();
        setMilitares(lista);
        setDetalhe(null);
        setItensDetalhe([]);
      }
    } finally {
      setCarregando(false);
    }
  }, [foco?.nip, foco?.cadastroId, foco?.nome]);

  useEffect(() => {
    if (!visible) {
      setItemParaExcluir(null);
      return;
    }
    void carregar();
  }, [visible, carregar]);

  const abrirMilitar = useCallback((m: MilitarComHistoricoSubstituido) => {
    setDetalhe(m);
    setItensDetalhe(m.itens);
  }, []);

  const voltarLista = useCallback(() => {
    if (foco?.nip || foco?.cadastroId) {
      onClose();
      return;
    }
    setDetalhe(null);
    setItensDetalhe([]);
  }, [foco?.nip, foco?.cadastroId, onClose]);

  const executarExclusao = useCallback(async () => {
    if (!itemParaExcluir || excluindo) return;
    const removidoId = itemParaExcluir.id;
    setExcluindo(true);
    try {
      await excluirResultadoSubstituido(removidoId);
      setItemParaExcluir(null);
      const restantes = itensDetalhe.filter((i) => i.id !== removidoId);
      setItensDetalhe(restantes);
      if (detalhe) {
        setDetalhe({ ...detalhe, total: restantes.length, itens: restantes });
      }
      if (restantes.length === 0) {
        if (foco?.nip || foco?.cadastroId) {
          await carregar();
        } else {
          setDetalhe(null);
          const lista = await listarMilitaresComHistoricoSubstituido();
          setMilitares(lista);
        }
      } else if (!(foco?.nip || foco?.cadastroId)) {
        const lista = await listarMilitaresComHistoricoSubstituido();
        setMilitares(lista);
      }
    } finally {
      setExcluindo(false);
    }
  }, [itemParaExcluir, excluindo, itensDetalhe, detalhe, foco?.nip, foco?.cadastroId, carregar]);

  return (
    <>
      <ModernModal
        visible={visible}
        onClose={onClose}
        title={detalhe ? `Histórico · ${detalhe.nome}` : 'Histórico de resultados substituídos'}
        icon={<History size={20} color="#FFFFFF" strokeWidth={2.2} />}
        fullScreen
      >
        {carregando ? (
          <View style={styles.center}>
            <ActivityIndicator color="#ea580c" size="large" />
          </View>
        ) : detalhe ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            {!(foco?.nip || foco?.cadastroId) ? (
              <TouchableOpacity
                onPress={voltarLista}
                style={styles.backRow}
                accessibilityLabel="Voltar"
              >
                <ArrowLeft size={16} color="#ea580c" strokeWidth={2.4} />
                <Text style={[ts.caption, { color: '#ea580c', fontWeight: '700' }]}>
                  Voltar à lista
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[ts.caption, { color: ORANGE_MUTED, marginBottom: 12 }]}>
              NIP {detalhe.nip}
              {detalhe.postoGrad ? ` · ${detalhe.postoGrad}` : ''} · {detalhe.total} resultado
              {detalhe.total !== 1 ? 's' : ''} substituído{detalhe.total !== 1 ? 's' : ''}
            </Text>
            {itensDetalhe.length === 0 ? (
              <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
                Nenhum resultado substituído guardado para este militar.
              </Text>
            ) : (
              itensDetalhe.map((item) => (
                <View
                  key={item.id}
                  style={[styles.card, styles.cardHistorico]}
                >
                  <HistoricoSubstituidoStripe />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.cardTitle, { color: ORANGE_TEXT }]}>
                          {item.modalidadeLabel}
                        </Text>
                        <Text style={[ts.caption, { color: ORANGE_MUTED }]}>
                          Aplicado em {item.dataAplicacao} · Substituído em{' '}
                          {formatQuando(item.replacedAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setItemParaExcluir(item)}
                        disabled={excluindo}
                        accessibilityLabel={`Excluir histórico de ${item.modalidadeLabel}`}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color="#c2410c" strokeWidth={2.3} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, { color: ORANGE_TEXT }]}>Nota: {item.nota}</Text>
                      <Text style={[styles.meta, { color: ORANGE_TEXT }]}>
                        Situação: {item.situacao}
                      </Text>
                      <Text style={[styles.meta, { color: ORANGE_TEXT }]}>Tempo: {item.tempo}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : militares.length === 0 ? (
          <View style={styles.center}>
            <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Ainda não há resultados substituídos guardados.
            </Text>
            <Text
              style={[ts.caption, { color: theme.textMuted, textAlign: 'center', marginTop: 8 }]}
            >
              Quando um teste for repetido ou um resultado for editado e substituir o anterior, ele
              aparece aqui.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            <Text style={[ts.caption, { color: ORANGE_MUTED, marginBottom: 12 }]}>
              Toque no militar para ver os resultados anteriores que foram substituídos.
            </Text>
            {militares.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => abrirMilitar(m)}
                style={[styles.card, styles.cardHistorico]}
                accessibilityLabel={`Histórico de ${m.nome}`}
              >
                <HistoricoSubstituidoStripe />
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: ORANGE_TEXT }]} numberOfLines={2}>
                    {m.nome}
                  </Text>
                  <Text style={[ts.caption, { color: ORANGE_MUTED }]}>
                    NIP {m.nip}
                    {m.postoGrad ? ` · ${m.postoGrad}` : ''} · {m.total} substituído
                    {m.total !== 1 ? 's' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </ModernModal>

      <ConfirmacaoExcluirHistoricoSubstituidoModal
        visible={itemParaExcluir != null}
        nome={itemParaExcluir?.nome ?? ''}
        nip={itemParaExcluir?.nip ?? ''}
        modalidadeLabel={itemParaExcluir?.modalidadeLabel ?? ''}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setItemParaExcluir(null);
        }}
        onConfirm={() => void executarExclusao()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 220,
  },
  content: {
    paddingBottom: 24,
    gap: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  card: {
    borderWidth: 2,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 88,
  },
  cardHistorico: {
    backgroundColor: ORANGE_BG,
    borderColor: ORANGE_BORDER,
  },
  cardBody: {
    padding: 12,
    gap: 4,
    zIndex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  deleteBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    borderColor: ORANGE_BORDER,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  metaRow: {
    marginTop: 6,
    gap: 2,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
});
