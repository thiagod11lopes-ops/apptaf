import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from './PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

export type ModoDemonstracaoModalPhase = 'confirm' | 'loading' | 'success' | 'error';

type Props = {
  visible: boolean;
  phase: ModoDemonstracaoModalPhase;
  /** true = ativar Modo Teste; false = desativar */
  ativar: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

function tituloModal(phase: ModoDemonstracaoModalPhase, ativar: boolean): string {
  if (phase === 'loading') {
    return ativar ? 'Ativando Modo Teste…' : 'Desativando Modo Teste…';
  }
  if (phase === 'success') {
    return ativar ? 'Modo Teste ativo' : 'Modo Teste desativado';
  }
  if (phase === 'error') {
    return 'Não foi possível concluir';
  }
  return ativar ? 'Ativar Modo Teste?' : 'Desativar Modo Teste?';
}

export function ConfirmacaoModoDemonstracaoModal({
  visible,
  phase,
  ativar,
  errorMessage = null,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const loading = phase === 'loading';
  const concluido = phase === 'success' || phase === 'error';

  const footer = concluido ? (
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
  ) : (
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
          colors={ativar ? [...t.gradientPrimaryBtn] : [...t.gradientDangerBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnPrimary,
            Platform.OS === 'web'
              ? ({
                  boxShadow: ativar
                    ? '0 6px 16px rgba(37, 99, 235, 0.32)'
                    : '0 6px 16px rgba(220, 38, 38, 0.35)',
                } as object)
              : undefined,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>{ativar ? 'Ativar' : 'Desativar'}</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  const icon =
    phase === 'success' ? (
      <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2.2} />
    ) : phase === 'error' ? (
      <AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />
    ) : (
      <Sparkles size={20} color="#FFFFFF" strokeWidth={2.2} />
    );

  return (
    <ModernModal
      visible={visible}
      onClose={loading ? () => {} : onClose}
      title={tituloModal(phase, ativar)}
      icon={icon}
      footer={footer}
      dismissable={!loading}
    >
      <View style={styles.body}>
        {phase === 'confirm' ? (
          <>
            <Text style={[styles.message, { color: theme.text }]}>
              {ativar
                ? 'Disponibiliza militares fictícios só na aba Aplicar TAF e preenche os NIPs automaticamente. Os testes só entram no Histórico depois de aplicados, com a tarja “Modo Teste”. Não alteram planilhas, backup nem sincronização.'
                : 'Remove os militares fictícios da aba Aplicar. Sessões de Modo Teste já aplicadas permanecem no Histórico.'}
            </Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {ativar
                ? 'Ao confirmar, os NIPs dos participantes serão preenchidos automaticamente com militares de exemplo.'
                : 'Seus dados reais não são apagados ao desativar o Modo Teste.'}
            </Text>
          </>
        ) : null}

        {phase === 'loading' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.message, { color: theme.textSecondary, textAlign: 'center' }]}>
              {ativar
                ? 'Preparando militares de exemplo para Aplicar TAF…'
                : 'Desativando Modo Teste…'}
            </Text>
          </View>
        ) : null}

        {phase === 'success' ? (
          <Text style={[styles.message, { color: theme.text }]}>
            {ativar
              ? 'Modo Teste pronto. Os NIPs já foram preenchidos; aplique as provas normalmente. Ao finalizar, elas aparecem no Histórico com a tarja amarela.'
              : 'Modo Teste desativado. As sessões já aplicadas continuam no Histórico.'}
          </Text>
        ) : null}

        {phase === 'error' && errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
            <Text style={[styles.errorText, { color: theme.loss }]}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
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
  btnPrimaryOuter: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
