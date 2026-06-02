import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, Users } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

export type ConfirmacaoGerarResultadosPdfInfo = {
  qtdMilitares: number;
  folhasA4: number;
  subtitulo: string;
};

type Props = {
  info: ConfirmacaoGerarResultadosPdfInfo | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmacaoGerarResultadosPdfModal({
  info,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const visible = !!info;

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} disabled={loading} style={styles.btnPrimaryOuter}>
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
              <FileText size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>Gerar PDF</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Gerar Resultados?"
      icon={<FileText size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {info ? (
        <View style={styles.body}>
          <Text style={[styles.message, { color: theme.text }]}>
            Será gerado um PDF apenas com militares que concluíram as{' '}
            <Text style={styles.strong}>três provas</Text> (corrida, natação e permanência) conforme
            o histórico de aplicações.
          </Text>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
              <Users size={22} color={theme.primary} strokeWidth={2.2} />
              <Text style={[styles.statValue, { color: theme.text }]}>{info.qtdMilitares}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                militar{info.qtdMilitares !== 1 ? 'es' : ''}
              </Text>
            </View>
            <View style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
              <FileText size={22} color={theme.primary} strokeWidth={2.2} />
              <Text style={[styles.statValue, { color: theme.text }]}>{info.folhasA4}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                folha{info.folhasA4 !== 1 ? 's' : ''} A4
              </Text>
            </View>
          </View>

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Formato A4 paisagem · estimativa de impressão com base no layout da tabela (inclui
            rúbricas).
          </Text>
          {info.subtitulo ? (
            <Text style={[styles.subtitulo, { color: theme.textSecondary }]}>{info.subtitulo}</Text>
          ) : null}
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 4 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 16, textAlign: 'center' },
  strong: { fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', fontStyle: 'italic' },
  subtitulo: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  footerRow: { flexDirection: 'row', gap: 10, flex: 1, width: '100%' },
  btnGhost: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700' },
  btnPrimaryOuter: { flex: 1.1, borderRadius: 12, overflow: 'hidden' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
