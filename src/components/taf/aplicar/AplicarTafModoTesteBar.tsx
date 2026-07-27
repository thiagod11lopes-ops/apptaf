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
  onPreencherNips: () => void;
  preenchendoNips?: boolean;
};

/**
 * Controles de Modo Teste na etapa de NIPs (após confirmar nº de participantes).
 */
export function AplicarTafModoTesteBar({ onPreencherNips, preenchendoNips = false }: Props) {
  const { theme } = useTheme();
  const [demoAtivo, setDemoAtivo] = useState(isModoDemonstracaoAtivo);
  const [demoCarregando, setDemoCarregando] = useState(false);
  const [demoModal, setDemoModal] = useState<{
    phase: ModoDemonstracaoModalPhase;
    ativar: boolean;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => subscribeModoDemonstracao(() => setDemoAtivo(isModoDemonstracaoAtivo())), []);

  const fecharModal = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal(null);
  }, [demoCarregando]);

  const abrirConfirmacao = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal({ phase: 'confirm', ativar: !demoAtivo });
  }, [demoAtivo, demoCarregando]);

  const confirmar = useCallback(() => {
    if (!demoModal || demoCarregando) return;
    const { ativar } = demoModal;
    setDemoModal({ phase: 'loading', ativar });
    setDemoCarregando(true);
    void toggleModoDemonstracaoSistema()
      .then(({ ativo }) => {
        setDemoAtivo(ativo);
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
  }, [demoModal, demoCarregando]);

  return (
    <>
      <View style={styles.bar}>
        <TouchableOpacity
          accessibilityLabel={demoAtivo ? 'Desativar Modo Teste' : 'Ativar Modo Teste'}
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

        {demoAtivo ? (
          <TouchableOpacity
            accessibilityLabel="Preencher NIPs de exemplo"
            accessibilityHint="Preenche automaticamente os NIPs com militares fictícios"
            accessibilityRole="button"
            activeOpacity={0.85}
            disabled={preenchendoNips}
            onPress={onPreencherNips}
            style={[
              styles.fillBtn,
              {
                borderColor: theme.gain,
                backgroundColor: theme.gainMuted,
                opacity: preenchendoNips ? 0.65 : 1,
              },
            ]}
          >
            {preenchendoNips ? (
              <ActivityIndicator size="small" color={theme.gain} />
            ) : (
              <Text style={[styles.fillLabel, { color: theme.gain }]}>Preencher NIPs</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      <ConfirmacaoModoDemonstracaoModal
        visible={demoModal != null}
        phase={demoModal?.phase ?? 'confirm'}
        ativar={demoModal?.ativar ?? false}
        errorMessage={demoModal?.errorMessage}
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
    gap: 10,
    marginBottom: 14,
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
  fillBtn: {
    minHeight: PREMIUM.minTouch,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
