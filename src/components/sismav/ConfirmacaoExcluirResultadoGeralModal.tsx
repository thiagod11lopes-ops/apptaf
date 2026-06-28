import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2, ShieldAlert, UserX } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { ResultadoGeralItem } from '../../utils/resultadoTafCadastro';

type Props = {
  militar: ResultadoGeralItem | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function temModalidade(valor: string): boolean {
  const v = valor.trim();
  return v !== '' && v !== '—';
}

export function ConfirmacaoExcluirResultadoGeralModal({
  militar,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const visible = !!militar;

  const modalidades = militar
    ? [
        { label: 'Corrida', ativo: temModalidade(militar.notaCorrida) || temModalidade(militar.situacaoCorrida) },
        {
          label: 'Caminhada',
          ativo: temModalidade(militar.notaCaminhada) || temModalidade(militar.situacaoCaminhada),
        },
        { label: 'Natação', ativo: temModalidade(militar.notaNatacao) || temModalidade(militar.situacaoNatacao) },
        {
          label: 'Permanência',
          ativo: temModalidade(militar.permanenciaTempo) || temModalidade(militar.situacaoPermanencia),
        },
      ].filter((m) => m.ativo)
    : [];

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
          colors={['#EF4444', '#DC2626', '#B91C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnDanger,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)' } as object)
              : undefined,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Trash2 size={17} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.btnDangerText}>Excluir resultados</Text>
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
      title="Excluir todos os resultados?"
      icon={<ShieldAlert size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {militar ? (
        <View style={styles.bodyInner}>
          <LinearGradient
            colors={['rgba(239,68,68,0.18)', 'rgba(220,38,38,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroRing, { borderColor: theme.loss }]}
          >
            <View style={[styles.heroIcon, { backgroundColor: theme.lossMuted }]}>
              <UserX size={32} color={theme.loss} strokeWidth={2} />
            </View>
          </LinearGradient>

          <Text style={[styles.message, { color: theme.text }]}>
            Todos os resultados TAF de{' '}
            <Text style={styles.strong}>{militar.nome}</Text>
            {militar.nip && militar.nip !== '—' ? (
              <>
                {' '}
                (NIP <Text style={styles.strong}>{militar.nip}</Text>)
              </>
            ) : null}{' '}
            serão removidos permanentemente.
          </Text>

          {modalidades.length > 0 ? (
            <View style={styles.chipsWrap}>
              {modalidades.map((m) => (
                <View
                  key={m.label}
                  style={[styles.chip, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}
                >
                  <Text style={[styles.chipText, { color: theme.loss }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.alertBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <ShieldAlert size={16} color={theme.loss} strokeWidth={2.2} />
            <Text style={[styles.alertText, { color: theme.textSecondary }]}>
              O cadastro do militar será mantido. Apenas corrida, caminhada, natação e permanência serão
              apagados do histórico. Esta ação não pode ser desfeita.
            </Text>
          </View>
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  bodyInner: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 14,
  },
  heroRing: {
    padding: 4,
    borderRadius: 28,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: {
    fontWeight: '800',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
