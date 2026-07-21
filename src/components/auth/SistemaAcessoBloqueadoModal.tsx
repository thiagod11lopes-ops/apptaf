import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { SYSTEM_ACCESS_BLOCKED_MESSAGE } from '../../services/supabase/systemAccessGate';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SistemaAcessoBloqueadoModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const footer = (
    <PressableScale onPress={onClose} style={styles.btnOuter}>
      <LinearGradient
        colors={[...t.gradientPrimaryBtn]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.btn,
          Platform.OS === 'web'
            ? ({ boxShadow: '0 6px 16px rgba(1, 75, 160, 0.28)' } as object)
            : undefined,
        ]}
      >
        <Text style={styles.btnText}>Entendi</Text>
      </LinearGradient>
    </PressableScale>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Acesso negado"
      icon={<ShieldAlert size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.body}>
        <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
          <ShieldAlert size={28} color={theme.loss} strokeWidth={2} />
        </View>
        <Text style={[styles.message, { color: theme.text }]}>{SYSTEM_ACCESS_BLOCKED_MESSAGE}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Peça ao administrador (chefe) para cadastrar seu e-mail em Configurações → E-mails
          autorizados.
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: 12,
  },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  btnOuter: { width: '100%' },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
