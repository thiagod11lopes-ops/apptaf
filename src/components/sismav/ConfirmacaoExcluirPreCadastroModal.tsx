import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2, AlertTriangle } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  idPreCadastroNatacaoDePermanenciaPareada,
  idPreCadastroPermanenciaPareada,
  type PreCadastroTaf,
} from '../../services/preCadastroTafStorage';

const LABEL_TIPO: Record<string, string> = {
  corrida: 'Corrida',
  natacao: 'Natação',
  permanencia: 'Permanência',
  caminhada: 'Caminhada',
  flexao_barra: 'Flexão de Barra',
  flexao_solo: 'Flexão de Solo',
  abdominal_remador: 'Abdominal Remador',
  abdominal_prancha: 'Abdominal Prancha',
};

function labelTipoProva(tipo: PreCadastroTaf['tipoProva']): string {
  return LABEL_TIPO[tipo] || String(tipo);
}

/**
 * True quando existe o par natação↔permanência que também será removido.
 * Se `existentesIds` for informado, exige que o outro ID esteja na lista.
 */
export function preCadastroTemVinculoNatacaoPermanencia(
  pre: PreCadastroTaf,
  existentesIds?: ReadonlySet<string> | readonly string[],
): boolean {
  const hasId = (id: string): boolean => {
    if (!existentesIds) return true;
    if (existentesIds instanceof Set) return existentesIds.has(id);
    return existentesIds.includes(id);
  };

  if (pre.tipoProva === 'natacao') {
    return hasId(idPreCadastroPermanenciaPareada(pre.id));
  }
  if (pre.tipoProva === 'permanencia') {
    const natacaoId = idPreCadastroNatacaoDePermanenciaPareada(pre.id);
    return !!natacaoId && hasId(natacaoId);
  }
  return false;
}

function labelVinculoOutro(pre: PreCadastroTaf): string {
  if (pre.tipoProva === 'natacao') return 'Permanência';
  return 'Natação';
}

type Props = {
  preCadastro: PreCadastroTaf | null;
  /** IDs ativos — usado para confirmar se o par vinculado existe. */
  existentesIds?: ReadonlySet<string> | readonly string[];
  /** Força o aviso de exclusão do par (opcional). */
  excluirVinculado?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmacaoExcluirPreCadastroModal({
  preCadastro,
  existentesIds,
  excluirVinculado = false,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const visible = !!preCadastro;
  const tipo = preCadastro ? labelTipoProva(preCadastro.tipoProva) : '';
  const nomeCodigo = (preCadastro?.nomeCodigo || '').trim();
  const n = preCadastro?.participantes.length ?? 0;
  const vinculado =
    !!preCadastro &&
    (excluirVinculado || preCadastroTemVinculoNatacaoPermanencia(preCadastro, existentesIds));

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
              <Text style={styles.btnDangerText}>Excluir</Text>
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
      title="Excluir pré-cadastro?"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      dismissable={!loading}
    >
      {preCadastro ? (
        <View style={styles.bodyInner}>
          <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
            <Trash2 size={28} color={theme.loss} strokeWidth={2} />
          </View>
          <Text style={[styles.message, { color: theme.text }]}>
            O pré-cadastro de <Text style={styles.strong}>{tipo}</Text>
            {nomeCodigo ? (
              <>
                {' '}
                (<Text style={styles.strong}>{nomeCodigo}</Text>)
              </>
            ) : null}{' '}
            com <Text style={styles.strong}>{n}</Text> participante{n !== 1 ? 's' : ''} será removido
            permanentemente.
          </Text>
          {vinculado ? (
            <View
              style={[
                styles.vinculoBox,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(251,191,36,0.12)'
                    : 'rgba(251,191,36,0.16)',
                  borderColor: theme.isDark ? 'rgba(251,191,36,0.35)' : 'rgba(180,83,9,0.35)',
                },
              ]}
            >
              <Text style={[styles.vinculoText, { color: theme.isDark ? '#fbbf24' : '#92400e' }]}>
                O pré-cadastro vinculado de{' '}
                <Text style={styles.strong}>{labelVinculoOutro(preCadastro)}</Text> também será
                excluído.
              </Text>
            </View>
          ) : null}
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Esta ação não pode ser desfeita.
          </Text>
        </View>
      ) : null}
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
    flex: 1,
  },
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
  bodyInner: {
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: {
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
  vinculoBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  vinculoText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },
});
