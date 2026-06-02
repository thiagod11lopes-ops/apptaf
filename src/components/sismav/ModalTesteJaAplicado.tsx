import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { RegistroModalidadeExistente } from '../../utils/registroModalidadeHistorico';

export type ModalTesteJaAplicadoInfo = {
  index: number;
  nip: string;
  nome: string;
  registro: RegistroModalidadeExistente;
};

type Props = {
  info: ModalTesteJaAplicadoInfo | null;
  onClose: () => void;
  onConfirmarRepeticao: () => void;
};

export function ModalTesteJaAplicado({ info, onClose, onConfirmarRepeticao }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const [etapa, setEtapa] = useState<'info' | 'confirmar'>('info');

  useEffect(() => {
    if (info) setEtapa('info');
  }, [info]);

  const visible = !!info;
  const reg = info?.registro;

  const footer =
    etapa === 'info' ? (
      <View style={styles.footerCol}>
        <PressableScale
          onPress={onClose}
          style={[styles.btnGhost, { borderColor: theme.border }]}
        >
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Manter registro anterior</Text>
        </PressableScale>
        <PressableScale onPress={() => setEtapa('confirmar')} style={styles.btnPrimaryOuter}>
          <LinearGradient
            colors={[...t.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btnPrimary}
          >
            <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.btnPrimaryText}>Repetir teste</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    ) : (
      <View style={styles.footerCol}>
        <PressableScale
          onPress={() => setEtapa('info')}
          style={[styles.btnGhost, { borderColor: theme.border }]}
        >
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Voltar</Text>
        </PressableScale>
        <PressableScale onPress={onConfirmarRepeticao} style={styles.btnDangerOuter}>
          <LinearGradient
            colors={[...t.gradientDangerBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.btnPrimary,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 6px 16px rgba(220, 38, 38, 0.35)' } as object)
                : undefined,
            ]}
          >
            <ShieldAlert size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.btnPrimaryText}>Confirmar repetição</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title={etapa === 'info' ? 'Teste já aplicado' : 'Substituir resultado?'}
      icon={
        etapa === 'info' ? (
          <AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : (
          <ShieldAlert size={20} color="#FFFFFF" strokeWidth={2.2} />
        )
      }
      footer={footer}
    >
      {info && reg ? (
        <View style={styles.body}>
          {etapa === 'info' ? (
            <>
              <Text style={[styles.message, { color: theme.text }]}>
                O militar <Text style={styles.strong}>{info.nome}</Text> (NIP{' '}
                <Text style={styles.strong}>{info.nip}</Text>) já possui registro de{' '}
                <Text style={styles.strong}>{reg.modalidadeLabel}</Text>.
              </Text>
              <View style={[styles.resultBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.resultLabel, { color: theme.textMuted }]}>Resultado anterior</Text>
                <Text style={[styles.resultLine, { color: theme.text }]}>
                  Data: <Text style={styles.strong}>{reg.dataAplicacao}</Text>
                </Text>
                <Text style={[styles.resultLine, { color: theme.text }]}>
                  Tempo: <Text style={styles.strong}>{reg.tempo}</Text>
                </Text>
                <Text style={[styles.resultLine, { color: theme.text }]}>
                  Nota: <Text style={styles.strong}>{reg.nota}</Text>
                </Text>
                <Text
                  style={[
                    styles.resultLine,
                    {
                      color:
                        reg.situacao === 'Reprovado'
                          ? theme.loss
                          : reg.situacao === 'Aprovado'
                            ? theme.gain
                            : theme.text,
                    },
                  ]}
                >
                  Situação: <Text style={styles.strong}>{reg.situacao}</Text>
                </Text>
              </View>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Deseja repetir o teste? O registro anterior será mantido até você confirmar a repetição
                e concluir a nova aplicação.
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
                <ShieldAlert size={28} color={theme.loss} strokeWidth={2} />
              </View>
              <Text style={[styles.message, { color: theme.text }]}>
                Ao confirmar, o resultado anterior de{' '}
                <Text style={styles.strong}>{reg.modalidadeLabel}</Text> será{' '}
                <Text style={styles.strong}>perdido e substituído</Text> pelo novo teste quando você
                finalizar esta aplicação.
              </Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Esta ação não pode ser desfeita após salvar os novos resultados.
              </Text>
            </>
          )}
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 4 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  strong: { fontWeight: '800' },
  resultBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  resultLine: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', textAlign: 'center' },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  footerCol: { flex: 1, width: '100%', gap: 10 },
  btnGhost: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  btnPrimaryOuter: { borderRadius: 12, overflow: 'hidden' },
  btnDangerOuter: { borderRadius: 12, overflow: 'hidden' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
