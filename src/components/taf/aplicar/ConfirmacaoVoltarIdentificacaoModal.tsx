import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  provaLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** Confirma retorno à identificação — o teste em andamento será perdido. */
export function ConfirmacaoVoltarIdentificacaoModal({
  visible,
  provaLabel,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const prova = provaLabel.trim() || 'esta prova';

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} style={styles.btnDangerOuter}>
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
          <ArrowLeft size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.btnDangerText}>Voltar à identificação</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Voltar à identificação?"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.bodyInner}>
        <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
          <AlertTriangle size={28} color={theme.loss} strokeWidth={2} />
        </View>
        <Text style={[styles.message, { color: theme.text }]}>
          O teste atual de <Text style={styles.strong}>{prova}</Text> será{' '}
          <Text style={styles.strong}>perdido</Text>. Tempos, marcas e o andamento do cronômetro não
          serão salvos.
        </Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Os NIPs já confirmados na identificação serão mantidos.
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnDangerOuter: {
    flex: 1.35,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyInner: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
  },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: {
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
});
