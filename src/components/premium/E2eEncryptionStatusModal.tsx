import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from './PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  e2eActive: boolean;
  onClose: () => void;
};

export function E2eEncryptionStatusModal({ visible, e2eActive, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const statusColor = e2eActive ? theme.gain : theme.loss;

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Criptografia dos cadastros"
      icon={
        e2eActive ? (
          <ShieldCheck size={22} color="#FFFFFF" strokeWidth={2.4} />
        ) : (
          <ShieldAlert size={22} color="#FFFFFF" strokeWidth={2.4} />
        )
      }
      footer={
        <View style={styles.footerRow}>
          <PressableScale onPress={onClose} style={styles.btnPrimaryOuter}>
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
              <Text style={styles.btnPrimaryText}>Entendi</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      }
    >
      <View style={styles.body}>
        <View
          style={[
            styles.statusChip,
            {
              backgroundColor: e2eActive ? theme.gainMuted : 'rgba(220, 38, 38, 0.12)',
              borderColor: statusColor,
            },
          ]}
        >
          <Shield size={18} color={statusColor} strokeWidth={2.4} />
          <Text style={[styles.statusChipText, { color: statusColor }]}>
            {e2eActive ? 'Criptografia ativa' : 'Criptografia inativa'}
          </Text>
        </View>

        {e2eActive ? (
          <>
            <Text style={[styles.paragraph, { color: theme.text }]}>
              A chave da equipe está desbloqueada nesta sessão. Ao sincronizar com a nuvem, o{' '}
              <Text style={styles.em}>NIP</Text> e o <Text style={styles.em}>nome</Text> dos
              militares vão cifrados (AES-GCM) — quem olhar o banco na nuvem não lê esses dados
              sem a chave.
            </Text>
            <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
              No aparelho (uso offline), os cadastros continuam legíveis para o app funcionar sem
              internet.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.paragraph, { color: theme.text }]}>
              A chave de criptografia <Text style={styles.em}>não está ativa</Text> nesta sessão.
              Enquanto isso, o sistema <Text style={styles.em}>não envia</Text> NIP e nome em texto
              claro para a nuvem — a sincronização é bloqueada até desbloquear a chave.
            </Text>
            <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
              Para ativar: saia da conta e entre novamente com <Text style={styles.em}>e-mail e
              senha</Text>. Depois disso, o ícone fica verde e os cadastros sincronizam cifrados.
            </Text>
          </>
        )}

        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          Verde = NIP e nome protegidos na nuvem · Vermelho = chave inativa nesta sessão
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  em: {
    fontWeight: '700',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btnPrimaryOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 120,
  },
  btnPrimary: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
