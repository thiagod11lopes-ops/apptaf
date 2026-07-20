import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2, AlertTriangle } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { ModalidadeResultadoTaf } from '../../utils/limparResultadoModalidade';
import { labelModalidadeResultado } from '../../utils/limparResultadoModalidade';

type Props = {
  visible: boolean;
  nome: string;
  nip: string;
  modalidade: ModalidadeResultadoTaf | null;
  /** Quando a prova não é corrida/natação/permanência/caminhada (ex.: flexão). */
  rotuloProva?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmacaoExcluirResultadoModal({
  visible,
  nome,
  nip,
  modalidade,
  rotuloProva,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const modLabel =
    (modalidade ? labelModalidadeResultado(modalidade) : '') ||
    (rotuloProva || '').trim() ||
    'prova';

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} disabled={loading} style={styles.btnDangerOuter}>
        <LinearGradient
          colors={[...t.gradientDangerBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnDanger,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 16px rgba(220, 38, 38, 0.35)' } as object)
              : undefined,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Trash2 size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.btnDangerText}>Excluir resultado</Text>
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
      title="Excluir resultado?"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.bodyInner}>
        <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
          <Trash2 size={28} color={theme.loss} strokeWidth={2} />
        </View>
        <Text style={[styles.message, { color: theme.text }]}>
          O resultado de{' '}
          <Text style={styles.strong}>{modLabel}</Text> de{' '}
          <Text style={styles.strong}>{nome}</Text>
          {nip && nip !== '—' ? (
            <>
              {' '}
              (NIP <Text style={styles.strong}>{nip}</Text>)
            </>
          ) : null}{' '}
          será removido permanentemente do cadastro.
        </Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Esta ação não pode ser desfeita. Os demais resultados do militar serão mantidos.
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  bodyInner: { alignItems: 'center', paddingVertical: 4 },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  strong: { fontWeight: '800' },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    width: '100%',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700' },
  btnDangerOuter: {
    flex: 1.2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
