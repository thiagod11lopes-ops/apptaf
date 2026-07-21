import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ClipboardList, HeartPulse, Trash2 } from 'lucide-react-native';
import { ModernModal } from './sismav/ModernModal';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import {
  wipeAllFatoresRiscoData,
  wipeAllTestesData,
} from '../services/wipePartialDangerData';
import { PREMIUM } from '../theme/premium';

type Target = 'testes' | 'fatores' | null;

type Props = {
  onDone?: () => void;
};

export function ExclusoesEspecificasDangerBlock({ onDone }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { isAuthenticated, firebaseEnabled, isBoss } = useAuth();
  const [target, setTarget] = useState<Target>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const apagaNuvem = isAuthenticated && firebaseEnabled && isBoss;

  const fechar = useCallback(() => {
    if (loading) return;
    setTarget(null);
  }, [loading]);

  const executar = useCallback(async () => {
    if (!isBoss || !target) {
      setErro('Somente o e-mail chefe pode executar esta exclusão.');
      return;
    }
    setLoading(true);
    setErro(null);
    setSucesso(null);
    try {
      if (target === 'testes') {
        const result = await wipeAllTestesData({
          uid: getCachedDataOwnerUid(),
          wipeCloud: apagaNuvem,
        });
        const partes = [
          `${result.sessoesDeleted.toLocaleString('pt-BR')} teste(s)/sessão(ões) excluído(s).`,
        ];
        if (result.cadastrosLimpos > 0) {
          partes.push(
            `Resultados removidos de ${result.cadastrosLimpos.toLocaleString('pt-BR')} cadastro(s).`,
          );
        }
        partes.push('Cadastros, fatores de risco e aplicadores foram mantidos.');
        if (result.cloudCleared) {
          partes.push('Sessões correspondentes na nuvem também foram removidas.');
        }
        setSucesso(partes.join(' '));
      } else {
        const result = await wipeAllFatoresRiscoData();
        setSucesso(
          result.registrosRemovidos === 0
            ? 'Nenhum fator de risco encontrado para excluir.'
            : `${result.registrosRemovidos.toLocaleString('pt-BR')} registro(s) de fatores de risco excluído(s). Demais dados mantidos.`,
        );
      }
      setTarget(null);
      onDone?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a exclusão.');
    } finally {
      setLoading(false);
    }
  }, [apagaNuvem, isBoss, onDone, target]);

  if (!isBoss) return null;

  const isTestes = target === 'testes';
  const titulo = isTestes ? 'Excluir todos os testes?' : 'Excluir fatores de risco?';
  const mensagem = isTestes
    ? 'Serão removidos todos os testes/sessões de TAF e os resultados vinculados aos cadastros. Cadastros (dados pessoais), fatores de risco, aplicadores e pré-cadastros permanecem.'
    : 'Serão removidos todos os fatores de risco cadastrados. Cadastros, testes, aplicadores e demais dados permanecem.';
  const lista = isTestes
    ? [
        'Sessões e histórico de testes',
        'Resultados de TAF nos cadastros (tempos/notas)',
        ...(apagaNuvem ? ['Sessões de TAF na nuvem do chefe'] : []),
      ]
    : ['Todos os registros de fatores de risco neste aparelho'];

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={fechar}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={() => void executar()} disabled={loading} style={styles.btnDangerOuter}>
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
              <Text style={styles.btnDangerText}>Excluir</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        accessibilityLabel="Excluir todos os testes mantendo cadastros e fatores de risco"
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => {
          setErro(null);
          setSucesso(null);
          setTarget('testes');
        }}
        style={[
          styles.btnTrigger,
          {
            borderColor: theme.loss,
            backgroundColor: theme.isDark ? 'rgba(127, 29, 29, 0.18)' : 'rgba(254, 226, 226, 0.55)',
            opacity: loading ? 0.6 : 1,
          },
        ]}
      >
        <ClipboardList size={18} color={theme.loss} strokeWidth={2.4} />
        <View style={styles.btnTextCol}>
          <Text style={[styles.btnTriggerText, { color: theme.loss }]}>Excluir todos os testes</Text>
          <Text style={[ts.caption, { color: theme.textMuted, lineHeight: 16 }]}>
            Exclui os testes, mas mantém cadastros, fatores de risco, etc.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityLabel="Excluir fatores de risco mantendo os demais dados"
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => {
          setErro(null);
          setSucesso(null);
          setTarget('fatores');
        }}
        style={[
          styles.btnTrigger,
          {
            borderColor: theme.loss,
            backgroundColor: theme.isDark ? 'rgba(127, 29, 29, 0.18)' : 'rgba(254, 226, 226, 0.55)',
            opacity: loading ? 0.6 : 1,
          },
        ]}
      >
        <HeartPulse size={18} color={theme.loss} strokeWidth={2.4} />
        <View style={styles.btnTextCol}>
          <Text style={[styles.btnTriggerText, { color: theme.loss }]}>Excluir Fatores de Risco</Text>
          <Text style={[ts.caption, { color: theme.textMuted, lineHeight: 16 }]}>
            Mantém todos os outros dados.
          </Text>
        </View>
      </TouchableOpacity>

      {erro ? <Text style={[ts.caption, styles.feedback, { color: theme.error }]}>{erro}</Text> : null}
      {sucesso ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.success }]}>{sucesso}</Text>
      ) : null}

      <ModernModal
        visible={target != null}
        onClose={fechar}
        title={titulo}
        icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={footer}
      >
        <View style={styles.modalBody}>
          <View style={[styles.warnIcon, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
            <AlertTriangle size={28} color={theme.loss} strokeWidth={2} />
          </View>
          <Text style={[styles.message, { color: theme.text }]}>{mensagem}</Text>
          <View style={[styles.listBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {lista.map((item) => (
              <Text key={item} style={[styles.listItem, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>Esta ação não pode ser desfeita.</Text>
        </View>
      </ModernModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  btnTrigger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1.5,
  },
  btnTextCol: { flex: 1, gap: 2 },
  btnTriggerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  feedback: { lineHeight: 18 },
  modalBody: { gap: 12 },
  warnIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
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
  hint: {
    fontSize: 13,
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
