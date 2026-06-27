import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudUpload, CloudSync } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { SyncReport } from '../../offline-first/sync/syncReport';
import { summarizeSyncReport } from '../../offline-first/sync/syncReport';

type Props = {
  visible: boolean;
  report: SyncReport | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

function StatLine({ label, count, color }: { label: string; count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <Text style={[styles.statsLine, { color }]}>
      · {count} {label}
    </Text>
  );
}

export function RelatorioSincronizacaoModal({
  visible,
  report,
  loading = false,
  errorMessage = null,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const summary = report ? summarizeSyncReport(report) : null;

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} disabled={loading || !report} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnPrimary,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.32)' } as object)
              : undefined,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CloudUpload size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>Sincronizar</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={loading ? () => {} : onClose}
      title={errorMessage ? 'Falha na sincronização' : 'Relatório de sincronização'}
      icon={<CloudSync size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {report ? (
        <View style={styles.body}>
          {errorMessage ? (
            <View style={[styles.errorBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
              <Text style={[styles.errorText, { color: theme.loss }]}>{errorMessage}</Text>
            </View>
          ) : null}

          <Text style={[styles.message, { color: theme.text }]}>
            Compare os dados locais com a nuvem antes de sincronizar. Apenas diferenças serão enviadas
            ou baixadas.
          </Text>

          <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>Enviar para a nuvem</Text>
            <StatLine label="registro(s) novo(s)" count={report.novos.length} color={theme.text} />
            <StatLine label="registro(s) alterado(s)" count={report.alterados.length} color={theme.text} />
            <StatLine label="exclusão(ões)" count={report.excluidos.length} color={theme.text} />
          </View>

          <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>Baixar da nuvem</Text>
            <StatLine label="registro(s) novo(s)" count={report.baixarNovos.length} color={theme.text} />
            <StatLine label="registro(s) alterado(s)" count={report.baixarAlterados.length} color={theme.text} />
          </View>

          {report.ignorados.length > 0 ? (
            <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>Sem alteração (LWW)</Text>
              <StatLine label="registro(s) já alinhado(s)" count={report.ignorados.length} color={theme.textMuted} />
            </View>
          ) : null}

          <View style={[styles.totalsRow, { borderColor: theme.border }]}>
            <Text style={[styles.totalLine, { color: theme.textMuted }]}>
              Total local: {report.totalLocal} · Total na nuvem: {report.totalRemoto}
            </Text>
            {report.meta ? (
              <>
                <Text style={[styles.totalLine, { color: theme.textMuted }]}>
                  Usuário: {report.meta.userEmail ?? '—'} · Device: {report.meta.deviceId.slice(0, 12)}…
                </Text>
                <Text style={[styles.totalLine, { color: theme.textMuted }]}>
                  Cadastros {report.meta.collectionCounts.cadastros.local}/
                  {report.meta.collectionCounts.cadastros.remote} · Sessões{' '}
                  {report.meta.collectionCounts.sessoes.local}/{report.meta.collectionCounts.sessoes.remote} ·
                  Aplicadores {report.meta.collectionCounts.aplicadores.local}/
                  {report.meta.collectionCounts.aplicadores.remote}
                </Text>
                {report.meta.lastSyncAt ? (
                  <Text style={[styles.totalLine, { color: theme.textMuted }]}>
                    Última sync: {new Date(report.meta.lastSyncAt).toLocaleString('pt-BR')}
                  </Text>
                ) : null}
                {report.meta.clockDriftWarning ? (
                  <Text style={[styles.totalLine, { color: theme.loss, fontWeight: '600' }]}>
                    {report.meta.clockDriftWarning}
                  </Text>
                ) : null}
              </>
            ) : null}
          {summary ? (
            <>
              <Text style={[styles.totalLine, { color: theme.textSecondary, fontWeight: '700' }]}>
                Uploads: {summary.uploadCount} · Downloads: {summary.downloadCount} · Ignorados:{' '}
                {summary.ignoredCount}
              </Text>
              <Text style={[styles.totalLine, { color: theme.textSecondary, fontWeight: '700' }]}>
                {summary.totalChanges} alteração(ões) detectada(s)
              </Text>
            </>
          ) : null}
          </View>

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Após concluir, o app retorna automaticamente ao modo offline.
          </Text>
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  statsLine: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalsRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4,
  },
  totalLine: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flex: 1,
  },
  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimaryOuter: { borderRadius: 12, overflow: 'hidden' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
