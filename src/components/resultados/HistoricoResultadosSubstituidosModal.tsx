import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ArrowLeft, History, Trash2 } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import {
  excluirHistoricoProvaPreview,
  type HistoricoProvaPreviewItem,
} from '../../utils/resultadosAtuaisEHistoricosPreview';
import { nipDigitos } from '../../utils/nipFormat';
import { HistoricoSubstituidoStripe } from './HistoricoSubstituidoStripe';
import { ConfirmacaoExcluirHistoricoSubstituidoModal } from './ConfirmacaoExcluirHistoricoSubstituidoModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Se informado, abre direto no histórico desse militar. */
  foco?: { nip?: string; cadastroId?: string; nome?: string } | null;
  /** Históricos derivados das sessões (anteriores ao último por prova). */
  itensSessao?: HistoricoProvaPreviewItem[];
  onItemExcluido?: () => void | Promise<void>;
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

type MilitarGrupo = {
  key: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
  total: number;
  itens: HistoricoProvaPreviewItem[];
};

function agruparPorMilitar(itens: HistoricoProvaPreviewItem[]): MilitarGrupo[] {
  const byKey = new Map<string, MilitarGrupo>();
  for (const row of itens) {
    const key = row.cadastroId || nipDigitos(row.nip) || row.id;
    const atual = byKey.get(key);
    if (!atual) {
      byKey.set(key, {
        key,
        nip: row.nip,
        nome: row.nome,
        postoGrad: row.postoGrad,
        cadastroId: row.cadastroId,
        total: 1,
        itens: [row],
      });
      continue;
    }
    atual.total += 1;
    atual.itens.push(row);
    if (!atual.postoGrad && row.postoGrad) atual.postoGrad = row.postoGrad;
    if ((!atual.nome || atual.nome === '—') && row.nome && row.nome !== '—') {
      atual.nome = row.nome;
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function HistoricoResultadosSubstituidosModal({
  visible,
  onClose,
  foco = null,
  itensSessao = [],
  onItemExcluido,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const [excluindo, setExcluindo] = useState(false);
  const [itemParaExcluir, setItemParaExcluir] = useState<HistoricoProvaPreviewItem | null>(null);
  const [detalhe, setDetalhe] = useState<MilitarGrupo | null>(null);

  const militares = useMemo(() => agruparPorMilitar(itensSessao), [itensSessao]);

  useEffect(() => {
    if (!visible) {
      setItemParaExcluir(null);
      setDetalhe(null);
      return;
    }
    if (foco?.nip || foco?.cadastroId) {
      const nipKey = nipDigitos(foco.nip ?? '');
      const grupo =
        militares.find(
          (m) =>
            (foco.cadastroId && m.cadastroId === foco.cadastroId) ||
            (nipKey && nipDigitos(m.nip) === nipKey),
        ) ?? null;
      setDetalhe(grupo);
      return;
    }
    setDetalhe((prev) => {
      if (!prev) return null;
      return militares.find((m) => m.key === prev.key) ?? null;
    });
  }, [visible, foco?.nip, foco?.cadastroId, militares]);

  const itensDetalhe = detalhe?.itens ?? [];

  const abrirMilitar = useCallback((m: MilitarGrupo) => {
    setDetalhe(m);
  }, []);

  const voltarLista = useCallback(() => {
    if (foco?.nip || foco?.cadastroId) {
      onClose();
      return;
    }
    setDetalhe(null);
  }, [foco?.nip, foco?.cadastroId, onClose]);

  const executarExclusao = useCallback(async () => {
    if (!itemParaExcluir || excluindo) return;
    setExcluindo(true);
    try {
      await excluirHistoricoProvaPreview(itemParaExcluir);
      setItemParaExcluir(null);
      await onItemExcluido?.();
    } finally {
      setExcluindo(false);
    }
  }, [itemParaExcluir, excluindo, onItemExcluido]);

  return (
    <>
      <ModernModal
        visible={visible}
        onClose={onClose}
        title={detalhe ? `Histórico · ${detalhe.nome}` : 'Histórico de resultados anteriores'}
        icon={<History size={20} color="#FFFFFF" strokeWidth={2.2} />}
        fullScreen
      >
        {detalhe ? (
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
              {detalhe.postoGrad ? ` · ${detalhe.postoGrad}` : ''} · {itensDetalhe.length} resultado
              {itensDetalhe.length !== 1 ? 's' : ''} anterior
              {itensDetalhe.length !== 1 ? 'es' : ''}
            </Text>
            {itensDetalhe.length === 0 ? (
              <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
                Nenhum resultado histórico para este militar.
              </Text>
            ) : (
              itensDetalhe.map((item) => (
                <View key={item.id} style={[styles.card, styles.cardHistorico]}>
                  <HistoricoSubstituidoStripe />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.cardTitle, { color: ORANGE_TEXT }]}>
                          {item.modalidadeLabel}
                        </Text>
                        <Text style={[ts.caption, { color: ORANGE_MUTED }]}>
                          Aplicado em {item.dataAplicacao}
                          {item.origem === 'arquivo'
                            ? ` · Arquivado em ${formatQuando(item.sortTime)}`
                            : ''}
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
              Nenhum resultado histórico encontrado.
            </Text>
            <Text
              style={[ts.caption, { color: theme.textMuted, textAlign: 'center', marginTop: 8 }]}
            >
              Quando o militar tiver mais de um resultado na mesma prova, os anteriores aparecem
              aqui.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            <Text style={[ts.caption, { color: ORANGE_MUTED, marginBottom: 12 }]}>
              Toque no militar para ver os resultados anteriores (não são o último de cada prova).
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
                    {m.postoGrad ? ` · ${m.postoGrad}` : ''} · {m.total} histórico
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
