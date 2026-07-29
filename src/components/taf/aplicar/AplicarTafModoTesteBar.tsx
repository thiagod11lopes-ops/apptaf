import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { PREMIUM } from '../../../theme/premium';
import {
  isModoDemonstracaoAtivo,
  subscribeModoDemonstracao,
  toggleModoDemonstracaoSistema,
} from '../../../services/modoDemonstracao';
import {
  ConfirmacaoModoDemonstracaoModal,
  type ModoDemonstracaoModalPhase,
} from '../../premium/ConfirmacaoModoDemonstracaoModal';

type Props = {
  /** Preenche NIPs/nomes de exemplo para a quantidade informada (ao ativar). */
  onPreencherNips: (quantidade: number) => void | Promise<void>;
  /** Limpa os NIPs preenchidos (chamado ao desativar o Modo Teste). */
  onLimparNips: () => void;
  /** Quantidade sugerida no modal (ex.: participantes já na tela). */
  quantidadeInicial?: number;
  /** Máximo de participantes no Modo Teste. */
  quantidadeMaxima?: number;
};

/**
 * Modo Teste na etapa de NIPs: ao ativar pergunta a quantidade e preenche NIPs/nomes;
 * ao desativar limpa os campos.
 */
export function AplicarTafModoTesteBar({
  onPreencherNips,
  onLimparNips,
  quantidadeInicial = 1,
  quantidadeMaxima = 50,
}: Props) {
  const { theme } = useTheme();
  /** Sempre inicia desligado na montagem; o estado real vem do subscribe / ativação do usuário. */
  const [demoAtivo, setDemoAtivo] = useState(false);
  const [demoCarregando, setDemoCarregando] = useState(false);
  const [demoModal, setDemoModal] = useState<{
    phase: ModoDemonstracaoModalPhase;
    ativar: boolean;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => {
    setDemoAtivo(isModoDemonstracaoAtivo());
    return subscribeModoDemonstracao(() => setDemoAtivo(isModoDemonstracaoAtivo()));
  }, []);

  const fecharModal = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal(null);
  }, [demoCarregando]);

  const abrirConfirmacao = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal({ phase: 'confirm', ativar: !demoAtivo });
  }, [demoAtivo, demoCarregando]);

  const confirmar = useCallback(
    (quantidadeParticipantes?: number) => {
      if (!demoModal || demoCarregando) return;
      const { ativar } = demoModal;
      setDemoModal({ phase: 'loading', ativar });
      setDemoCarregando(true);
      void toggleModoDemonstracaoSistema()
        .then(async ({ ativo }) => {
          setDemoAtivo(ativo);
          if (ativo) {
            const n = Math.max(1, quantidadeParticipantes ?? quantidadeInicial);
            await onPreencherNips(n);
          } else {
            onLimparNips();
          }
          setDemoModal({ phase: 'success', ativar: ativo });
        })
        .catch((e) => {
          setDemoModal({
            phase: 'error',
            ativar,
            errorMessage: e instanceof Error ? e.message : 'Tente novamente.',
          });
        })
        .finally(() => setDemoCarregando(false));
    },
    [demoModal, demoCarregando, onPreencherNips, onLimparNips, quantidadeInicial],
  );

  return (
    <>
      <View style={styles.bar}>
        <TouchableOpacity
          accessibilityLabel={demoAtivo ? 'Desativar Modo Teste' : 'Ativar Modo Teste'}
          accessibilityHint={
            demoAtivo
              ? 'Desliga o Modo Teste e limpa os NIPs preenchidos'
              : 'Ativa o Modo Teste: informe a quantidade e preencha NIPs automaticamente'
          }
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={demoCarregando}
          onPress={abrirConfirmacao}
          style={[
            styles.toggleBtn,
            {
              borderColor: demoAtivo ? theme.gain : theme.border,
              backgroundColor: demoAtivo
                ? theme.gainMuted
                : theme.isDark
                  ? 'rgba(2,6,23,0.35)'
                  : 'rgba(255,255,255,0.55)',
              opacity: demoCarregando ? 0.65 : 1,
            },
            Platform.OS === 'web'
              ? ({ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' } as object)
              : { elevation: 2 },
          ]}
        >
          {demoCarregando ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Sparkles
              size={18}
              color={demoAtivo ? theme.gain : theme.textSecondary}
              strokeWidth={2.3}
            />
          )}
          <Text
            style={[
              styles.toggleLabel,
              { color: demoAtivo ? theme.gain : theme.textSecondary },
            ]}
          >
            {demoAtivo ? 'Modo Teste ativo' : 'Modo Teste'}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmacaoModoDemonstracaoModal
        visible={demoModal != null}
        phase={demoModal?.phase ?? 'confirm'}
        ativar={demoModal?.ativar ?? false}
        errorMessage={demoModal?.errorMessage}
        quantidadeInicial={Math.max(1, quantidadeInicial)}
        quantidadeMaxima={quantidadeMaxima}
        onClose={fecharModal}
        onConfirm={confirmar}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexShrink: 0,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: PREMIUM.minTouch,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1.5,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
