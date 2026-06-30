import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CloudDownload, CloudUpload } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { SyncQueueBreakdown } from '../../offline-first/sync/syncQueueBreakdown';

type Direction = 'download' | 'upload';

type Props = {
  visible: boolean;
  direction: Direction;
  breakdown: SyncQueueBreakdown;
  totalLabel: string | null;
  pendingCadastros?: number;
  isSyncing?: boolean;
  onDismissCadastroUploads?: () => Promise<{ ok: boolean; dismissed: number; error?: string }>;
  onClose: () => void;
};

export function SyncQueueDetailModal({
  visible,
  direction,
  breakdown,
  totalLabel,
  pendingCadastros = 0,
  isSyncing = false,
  onDismissCadastroUploads,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const isDownload = direction === 'download';
  const title = isDownload ? 'Receber da nuvem' : 'Enviar para a nuvem';
  const subtitle = isDownload
    ? 'Tipos de atualização que serão baixados deste dispositivo:'
    : 'Tipos de alteração local que serão enviados para a nuvem:';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!visible) {
      setConfirmOpen(false);
      setDismissing(false);
      setFeedback(null);
    }
  }, [visible]);

  const runDismissCadastros = useCallback(async () => {
    if (!onDismissCadastroUploads || pendingCadastros <= 0 || isSyncing || dismissing) return;

    setDismissing(true);
    setFeedback(null);
    try {
      const result = await onDismissCadastroUploads();
      if (result.ok && result.dismissed > 0) {
        setFeedback({
          kind: 'success',
          text: `${result.dismissed.toLocaleString('pt-BR')} cadastro(s) removidos da fila de envio.`,
        });
        setConfirmOpen(false);
        setTimeout(() => onClose(), 900);
        return;
      }
      if (result.ok && result.dismissed === 0) {
        setFeedback({
          kind: 'error',
          text: 'Nenhum cadastro pendente foi encontrado para dispensar. Tente fechar e abrir novamente.',
        });
        return;
      }
      setFeedback({
        kind: 'error',
        text: result.error ?? 'Não foi possível dispensar o envio.',
      });
    } finally {
      setDismissing(false);
    }
  }, [dismissing, isSyncing, onClose, onDismissCadastroUploads, pendingCadastros]);

  const showDismissCadastros =
    !isDownload && pendingCadastros > 0 && Boolean(onDismissCadastroUploads);

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title={title}
      dismissable={!dismissing}
      icon={
        isDownload ? (
          <CloudDownload size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : (
          <CloudUpload size={20} color="#FFFFFF" strokeWidth={2.2} />
        )
      }
    >
      <View style={styles.body}>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>

        {totalLabel ? (
          <View style={[styles.totalCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.totalValue, { color: theme.text }]}>{totalLabel}</Text>
            <Text style={[ts.caption, { color: theme.textMuted }]}>
              {isDownload ? 'atualização(ões) para receber' : 'alteração(ões) para enviar'}
            </Text>
          </View>
        ) : null}

        {breakdown.categories.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {isDownload
              ? 'Nenhuma atualização pendente para baixar da nuvem.'
              : 'Nenhuma alteração local pendente para enviar.'}
          </Text>
        ) : (
          <View style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
            {breakdown.categories.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.row,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                ]}
              >
                <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>
                <View style={[styles.countBadge, { backgroundColor: theme.accentMuted, borderColor: theme.primary }]}>
                  <Text style={[styles.countText, { color: theme.primary }]}>{item.count}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {showDismissCadastros ? (
          <>
            <Text style={[styles.dismissHint, { color: theme.textMuted }]}>
              Se os cadastros já existem na nuvem (ex.: importação local em massa), você pode dispensar
              o envio deles. Resultados, aplicadores e demais dados continuarão pendentes normalmente.
            </Text>

            {confirmOpen ? (
              <View style={[styles.confirmCard, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
                <Text style={[styles.confirmTitle, { color: theme.loss }]}>
                  Dispensar envio de {pendingCadastros.toLocaleString('pt-BR')} cadastro(s)?
                </Text>
                <Text style={[styles.confirmText, { color: theme.text }]}>
                  Eles serão marcados como já sincronizados neste aparelho, sem envio à nuvem. Use apenas se
                  tiver certeza de que já existem na nuvem.
                </Text>
                <View style={styles.confirmActions}>
                  <PressableScale
                    onPress={() => setConfirmOpen(false)}
                    disabled={dismissing}
                    style={[styles.confirmBtnGhost, { borderColor: theme.border, opacity: dismissing ? 0.5 : 1 }]}
                  >
                    <Text style={[styles.confirmBtnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => void runDismissCadastros()}
                    disabled={dismissing}
                    style={[
                      styles.confirmBtnDanger,
                      { borderColor: theme.loss, backgroundColor: theme.loss, opacity: dismissing ? 0.6 : 1 },
                    ]}
                  >
                    {dismissing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmBtnDangerText}>Confirmar</Text>
                    )}
                  </PressableScale>
                </View>
              </View>
            ) : (
              <PressableScale
                onPress={() => setConfirmOpen(true)}
                disabled={isSyncing || dismissing}
                style={[
                  styles.dismissBtn,
                  {
                    borderColor: theme.loss,
                    backgroundColor: theme.lossMuted,
                    opacity: isSyncing || dismissing ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.dismissBtnText, { color: theme.loss }]}>
                  Dispensar envio de cadastros ({pendingCadastros.toLocaleString('pt-BR')})
                </Text>
              </PressableScale>
            )}
          </>
        ) : null}

        {feedback ? (
          <View
            style={[
              styles.feedbackBox,
              {
                backgroundColor: feedback.kind === 'success' ? theme.gainMuted : theme.lossMuted,
                borderColor: feedback.kind === 'success' ? theme.gain : theme.loss,
              },
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                { color: feedback.kind === 'success' ? theme.gain : theme.loss },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        ) : null}
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  totalCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dismissHint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  dismissBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  confirmText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  confirmBtnGhost: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  confirmBtnGhostText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtnDanger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 110,
    alignItems: 'center',
  },
  confirmBtnDangerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
});
