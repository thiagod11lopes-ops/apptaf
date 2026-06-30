import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
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
  const [dismissing, setDismissing] = useState(false);

  const confirmDismissCadastros = useCallback(() => {
    if (!onDismissCadastroUploads || pendingCadastros <= 0 || isSyncing || dismissing) return;

    const countLabel = pendingCadastros.toLocaleString('pt-BR');
    Alert.alert(
      'Dispensar envio de cadastros?',
      `${countLabel} cadastro(s) serão marcados como já sincronizados neste aparelho, sem envio à nuvem. Resultados, aplicadores e outros dados não serão alterados.\n\nUse apenas se tiver certeza de que esses cadastros já existem na nuvem.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dispensar envio',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDismissing(true);
              try {
                const result = await onDismissCadastroUploads();
                if (result.ok) {
                  if (result.dismissed > 0) {
                    Alert.alert(
                      'Envio dispensado',
                      `${result.dismissed.toLocaleString('pt-BR')} cadastro(s) removidos da fila de envio.`,
                    );
                  }
                  onClose();
                } else if (result.error) {
                  Alert.alert('Não foi possível dispensar', result.error);
                }
              } finally {
                setDismissing(false);
              }
            })();
          },
        },
      ],
    );
  }, [dismissing, isSyncing, onClose, onDismissCadastroUploads, pendingCadastros]);

  const showDismissCadastros =
    !isDownload && pendingCadastros > 0 && Boolean(onDismissCadastroUploads);

  const footer =
    showDismissCadastros ? (
      <View style={styles.footerCol}>
        <PressableScale
          onPress={confirmDismissCadastros}
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
          {dismissing ? (
            <ActivityIndicator size="small" color={theme.loss} />
          ) : (
            <Text style={[styles.dismissBtnText, { color: theme.loss }]}>
              Dispensar envio de cadastros ({pendingCadastros.toLocaleString('pt-BR')})
            </Text>
          )}
        </PressableScale>
      </View>
    ) : undefined;

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title={title}
      footer={footer}
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
          <Text style={[styles.dismissHint, { color: theme.textMuted }]}>
            Se os cadastros já existem na nuvem (ex.: importação local em massa), você pode dispensar
            o envio deles. Resultados, aplicadores e demais dados continuarão pendentes normalmente.
          </Text>
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
  footerCol: {
    flex: 1,
    width: '100%',
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
});
