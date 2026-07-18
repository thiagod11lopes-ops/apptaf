import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Database, ShieldCheck, Scale } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

const TERMS_ITEMS = [
  'Sou responsável pelas informações cadastradas e pelo uso correto do sistema.',
  'Os dados inseridos devem respeitar as leis e normas aplicáveis, incluindo privacidade e proteção de dados.',
  'O acesso ao banco de dados será administrado pelo responsável pelo cadastro, incluindo a criação e gerenciamento de usuários.',
  'O sistema realizará armazenamento e sincronização dos dados conforme sua política de funcionamento, incluindo recursos de segurança, backup e controle de acesso.',
  'É proibido utilizar o sistema para inserir informações falsas, ilegais ou para acesso indevido a dados de terceiros.',
] as const;

type Props = {
  visible: boolean;
  email?: string | null;
  loading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function TermosCriacaoBancoModal({
  visible,
  email,
  loading = false,
  onAccept,
  onDecline,
}: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;

  const footer = useMemo(
    () => (
      <View style={styles.footerCol}>
        <PressableScale
          onPress={onAccept}
          disabled={loading}
          style={styles.btnPrimaryOuter}
          accessibilityRole="button"
          accessibilityLabel="Aceitar termos e continuar"
        >
          <LinearGradient
            colors={[...t.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.btnPrimary,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 10px 28px rgba(37, 99, 235, 0.35)' } as object)
                : { elevation: 6 },
              loading ? { opacity: 0.7 } : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.btnPrimaryText}>Li e aceito — continuar</Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
        <PressableScale
          onPress={onDecline}
          disabled={loading}
          style={[
            styles.btnGhost,
            {
              borderColor: theme.border,
              opacity: loading ? 0.5 : 1,
              backgroundColor: isDark ? 'rgba(15,23,42,0.35)' : 'rgba(248,250,252,0.9)',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Recusar termos e cancelar"
        >
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>
            Recusar e sair
          </Text>
        </PressableScale>
      </View>
    ),
    [isDark, loading, onAccept, onDecline, t.gradientPrimaryBtn, theme.border, theme.textSecondary],
  );

  return (
    <ModernModal
      visible={visible}
      onClose={loading ? () => undefined : onDecline}
      dismissable={!loading}
      title="Termos de criação de novo banco de dados"
      icon={<Database size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      maxBodyHeight={480}
    >
      <View style={styles.body}>
        <View
          style={[
            styles.heroBand,
            {
              backgroundColor: isDark ? 'rgba(37,99,235,0.14)' : 'rgba(37,99,235,0.08)',
              borderColor: isDark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.18)',
            },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: t.primary }]}>
            <Scale size={18} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>
              Novo banco de dados da equipe
            </Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              {email?.trim()
                ? `A conta ${email.trim()} não está vinculada a um chefe. Ao continuar, você cria e assume a responsabilidade pelo próprio banco.`
                : 'Esta conta não está vinculada a um chefe. Ao continuar, você cria e assume a responsabilidade pelo próprio banco.'}
            </Text>
          </View>
        </View>

        <Text style={[styles.lead, { color: theme.text }]}>
          Ao criar um novo banco de dados, declaro estar ciente e concordo que:
        </Text>

        <View style={styles.list}>
          {TERMS_ITEMS.map((item, index) => (
            <View
              key={item}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.72)',
                  borderColor: theme.border,
                },
              ]}
            >
              <LinearGradient
                colors={[...t.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.itemBadge}
              >
                <Text style={styles.itemBadgeText}>{index + 1}</Text>
              </LinearGradient>
              <Text style={[styles.itemText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.confirmBox,
            {
              borderColor: isDark ? 'rgba(96,165,250,0.35)' : 'rgba(37,99,235,0.25)',
              backgroundColor: isDark ? 'rgba(30,58,138,0.22)' : 'rgba(239,246,255,0.95)',
            },
          ]}
        >
          <Text style={[styles.confirmText, { color: theme.text }]}>
            Ao continuar, confirmo que li e aceito estes termos e assumo a responsabilidade pelo
            banco de dados criado.
          </Text>
        </View>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingBottom: 4,
  },
  heroBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  lead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  list: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  confirmBox: {
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  confirmText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footerCol: {
    gap: 10,
    width: '100%',
  },
  btnPrimaryOuter: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnPrimary: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  btnGhost: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
