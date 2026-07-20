import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react-native';
import { ModernModal } from './sismav/ModernModal';
import { WipeSystemProgressModal } from './WipeSystemProgressModal';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { wipeSystemData, type WipeProgressUpdate } from '../services/wipeSystemData';
import { PREMIUM } from '../theme/premium';

type Step = 'idle' | 'warn1' | 'warn2' | 'wiping';

type Props = {
  onWiped?: () => void;
};

export function ExcluirTodosDadosBlock({ onWiped }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { isAuthenticated, firebaseEnabled, isBoss } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [wipeProgress, setWipeProgress] = useState<WipeProgressUpdate | null>(null);
  const [wipeDone, setWipeDone] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  const apagaNuvem = isAuthenticated && firebaseEnabled && isBoss;

  const fechar = useCallback(() => {
    if (loading) return;
    setStep('idle');
  }, [loading]);

  const fecharProgresso = useCallback(() => {
    setStep('idle');
    setWipeProgress(null);
    setWipeDone(false);
    setWipeError(null);
    setLoading(false);
  }, []);

  const executar = useCallback(async () => {
    if (!isBoss) {
      setErro('Somente o e-mail chefe pode excluir todos os dados.');
      return;
    }
    setStep('wiping');
    setLoading(true);
    setErro(null);
    setSucesso(null);
    setWipeProgress(null);
    setWipeDone(false);
    setWipeError(null);
    try {
      const uid = getCachedDataOwnerUid();
      const result = await wipeSystemData({
        uid,
        wipeCloud: apagaNuvem,
        onProgress: setWipeProgress,
      });

      const partes = ['Dados locais removidos.'];
      if (result.cloudCleared && result.cloudCounts) {
        const { cadastros, sessoes, memberAccountsWiped } = result.cloudCounts;
        partes.push(
          `Nuvem zerada: ${cadastros.toLocaleString('pt-BR')} cadastro${cadastros !== 1 ? 's' : ''} e ${sessoes.toLocaleString('pt-BR')} sessão${sessoes !== 1 ? 'ões' : ''} de TAF.`,
        );
        if (memberAccountsWiped > 0) {
          partes.push(
            `${memberAccountsWiped} aparelho${memberAccountsWiped !== 1 ? 's' : ''} autorizado${memberAccountsWiped !== 1 ? 's' : ''} será${memberAccountsWiped !== 1 ? 'ão' : ''} esvaziado${memberAccountsWiped !== 1 ? 's' : ''} ao sincronizar.`,
          );
        }
        partes.push('Aparelhos autorizados serão esvaziados ao sincronizar.');
      }
      partes.push(
        'Se o escudo ficar vermelho: Conta → Sair → entre de novo com e-mail e senha.',
      );

      const msg = partes.join(' ');
      setSucesso(msg);
      setWipeDone(true);
      onWiped?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível excluir todos os dados.';
      setErro(msg);
      setWipeError(msg);
    } finally {
      setLoading(false);
    }
  }, [apagaNuvem, isBoss, onWiped]);

  if (!isBoss) return null;

  const listaItens = [
    'Cadastros de militares',
    'Resultados e sessões de TAF',
    'Aplicadores e pré-cadastros de provas',
    'Cache e alterações pendentes neste dispositivo',
    ...(apagaNuvem
      ? [
          'Todos os dados na nuvem (Firebase) do chefe',
          'Sincronização para esvaziar aparelhos autorizados',
        ]
      : []),
  ];

  const footerPrimeiro = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={fechar}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale
        onPress={() => setStep('warn2')}
        style={styles.btnDangerOuter}
      >
        <LinearGradient
          colors={['#b45309', '#ea580c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnDanger}
        >
          <AlertTriangle size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.btnDangerText}>Entendi o risco</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  const footerSegundo = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={() => setStep('warn1')}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Voltar</Text>
      </PressableScale>
      <PressableScale onPress={executar} disabled={loading} style={styles.btnDangerOuter}>
        <LinearGradient
          colors={[...theme.tokens.gradientDangerBtn]}
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
              <Text style={styles.btnDangerText}>Excluir tudo</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.dangerBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
        <ShieldAlert size={22} color={theme.loss} strokeWidth={2.2} />
        <Text style={[ts.caption, styles.dangerHint, { color: theme.textSecondary }]}>
          Remove permanentemente cadastros, resultados e cache
          {apagaNuvem ? ' — incluindo nuvem do chefe e aparelhos autorizados' : ' neste dispositivo'}.
          Faça backup antes se precisar recuperar depois.
        </Text>
      </View>

      <TouchableOpacity
        accessibilityLabel="Excluir todos os dados do sistema"
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => {
          setErro(null);
          setSucesso(null);
          setStep('warn1');
        }}
        style={[
          styles.btnTrigger,
          {
            borderColor: theme.loss,
            backgroundColor: theme.isDark ? 'rgba(127, 29, 29, 0.22)' : 'rgba(254, 226, 226, 0.65)',
            opacity: loading ? 0.6 : 1,
          },
        ]}
      >
        <Trash2 size={18} color={theme.loss} strokeWidth={2.4} />
        <Text style={[styles.btnTriggerText, { color: theme.loss }]}>Excluir todos os dados</Text>
      </TouchableOpacity>

      {erro && step === 'idle' ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.error }]}>{erro}</Text>
      ) : null}
      {sucesso && step === 'idle' ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.success }]}>{sucesso}</Text>
      ) : null}

      <ModernModal
        visible={step === 'warn1'}
        onClose={fechar}
        title="Atenção: perda de dados"
        icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={footerPrimeiro}
      >
        <View style={styles.modalBody}>
          <View style={[styles.warnIcon, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
            <AlertTriangle size={30} color={theme.loss} strokeWidth={2} />
          </View>
          <Text style={[styles.message, { color: theme.text }]}>
            Esta operação apagará <Text style={styles.strong}>todos os dados do sistema</Text> listados
            abaixo. Não há como desfazer.
          </Text>
          <View style={[styles.listBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {listaItens.map((item) => (
              <Text key={item} style={[styles.listItem, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
      </ModernModal>

      <ModernModal
        visible={step === 'warn2'}
        onClose={fechar}
        title="Confirmação final"
        icon={<ShieldAlert size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={footerSegundo}
      >
        <View style={styles.modalBody}>
          <LinearGradient
            colors={['#7f1d1d', '#dc2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.finalBanner}
          >
            <ShieldAlert size={28} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.finalBannerTitle}>Perigo — exclusão irreversível</Text>
            <Text style={styles.finalBannerText}>
              O sistema ficará completamente vazio para o chefe e para todos os e-mails autorizados.
            </Text>
          </LinearGradient>
          <Text style={[styles.message, { color: theme.text }]}>
            Ao tocar em <Text style={styles.strong}>Excluir tudo</Text>, todos os registros serão removidos
            {apagaNuvem ? ' deste dispositivo, da nuvem do chefe e dos aparelhos autorizados' : ' deste dispositivo'}.
          </Text>
        </View>
      </ModernModal>

      <WipeSystemProgressModal
        visible={step === 'wiping'}
        progress={wipeProgress}
        done={wipeDone}
        error={wipeError}
        successMessage={sucesso}
        onClose={fecharProgresso}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  dangerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  dangerHint: { flex: 1, lineHeight: 18 },
  btnTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1.5,
  },
  btnTriggerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  feedback: { lineHeight: 18 },
  modalBody: { gap: 14 },
  warnIcon: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: { fontWeight: '800' },
  listBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  listItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  finalBanner: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  finalBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  finalBannerText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
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
  btnDangerOuter: { flex: 1 },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
