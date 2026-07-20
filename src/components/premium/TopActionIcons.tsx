import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import {
  BookOpen,
  ClipboardList,
  Cloud,
  CloudOff,
  Settings,
  Shield,
  User,
  UserRoundCheck,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { navigateTab } from '../../navigation/navigationRef';
import type { RootStackParamList } from '../../navigation/types';
import { useE2eEncryptionStatus } from '../../hooks/useE2eEncryptionStatus';
import { ActionIconTooltip } from './ActionIconTooltip';
import { PressableScale } from './PressableScale';
import { E2eEncryptionStatusModal } from './E2eEncryptionStatusModal';
import { PREMIUM } from '../../theme/premium';
import {
  isModoDemonstracaoAtivo,
  subscribeModoDemonstracao,
  toggleModoDemonstracaoSistema,
} from '../../services/modoDemonstracao';
import {
  DEMO_TOTAL_CFN,
  DEMO_TOTAL_FEMININO,
  DEMO_TOTAL_MILITARES,
} from '../../utils/gerarDadosDemonstracaoTaf';
import {
  ConfirmacaoModoDemonstracaoModal,
  type ModoDemonstracaoModalPhase,
} from './ConfirmacaoModoDemonstracaoModal';

const ICON_SIZE = 22;
const BTN_SIZE = PREMIUM.minTouch;

const TOP_LINKS: {
  route: keyof RootStackParamList;
  label: string;
  description: string;
  Icon: typeof BookOpen;
}[] = [
  {
    route: 'Normas',
    label: 'Normas',
    description: 'Consultar tabelas e regras oficiais do TAF',
    Icon: BookOpen,
  },
  {
    route: 'CadastroAplicador',
    label: 'Aplicador',
    description: 'Cadastrar aplicadores de teste físico',
    Icon: UserRoundCheck,
  },
  {
    route: 'AplicacaoTAF',
    label: 'Registrador de TAF',
    description: 'Registrar resultados manualmente no cadastro',
    Icon: ClipboardList,
  },
];

type Props = {
  activeRoute: keyof RootStackParamList;
  /** Layout da faixa abaixo do subtítulo na Home */
  inline?: boolean;
  /** Centraliza os ícones na faixa (Home). */
  centered?: boolean;
};

function wrapTooltip(
  inline: boolean,
  title: string,
  description: string | undefined,
  node: React.ReactElement,
) {
  if (!inline) return node;
  return (
    <ActionIconTooltip title={title} description={description}>
      {node}
    </ActionIconTooltip>
  );
}

export function TopActionIcons({
  activeRoute,
  inline = false,
  centered = false,
}: Props) {
  const { theme } = useTheme();
  const { isAuthenticated, isBoss, firebaseEnabled } = useAuth();
  const { connectivity } = useOfflineSyncState();
  const { e2eActive } = useE2eEncryptionStatus();
  const cloudOnline = connectivity === 'ONLINE';
  const [e2eModalVisible, setE2eModalVisible] = useState(false);
  const [demoAtivo, setDemoAtivo] = useState(isModoDemonstracaoAtivo);
  const [demoCarregando, setDemoCarregando] = useState(false);
  const [demoModal, setDemoModal] = useState<{
    phase: ModoDemonstracaoModalPhase;
    ativar: boolean;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => subscribeModoDemonstracao(() => setDemoAtivo(isModoDemonstracaoAtivo())), []);

  const fecharModalDemonstracao = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal(null);
  }, [demoCarregando]);

  const alternarDemonstracao = useCallback(() => {
    if (demoCarregando) return;
    setDemoModal({ phase: 'confirm', ativar: !demoAtivo });
  }, [demoAtivo, demoCarregando]);

  const confirmarDemonstracao = useCallback(() => {
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
  const tabInk = theme.isDark ? '#FFFFFF' : '#111827';
  const iconSize = ICON_SIZE;
  const btnSize = BTN_SIZE;
  const strokeWidth = 2.2;

  const btnStyle = [
    styles.btn,
    {
      width: btnSize,
      height: btnSize,
      backgroundColor: theme.cardBg,
      borderColor: theme.border,
    },
    Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.1)' } as object)
      : { elevation: 8 },
  ];

  const e2eColor = e2eActive ? theme.gain : theme.loss;
  const e2eTooltipTitle = e2eActive ? 'Criptografia ativa' : 'Criptografia inativa';
  const e2eTooltipDescription = e2eActive
    ? 'NIP e nome vão cifrados para a nuvem. Toque para detalhes.'
    : 'Chave inativa nesta sessão. Toque para ver como ativar.';
  const showE2eShield = firebaseEnabled && isAuthenticated;
  const cloudColor = cloudOnline ? theme.gain : theme.loss;
  const cloudTooltipTitle = cloudOnline ? 'Online · nuvem' : 'Offline · local';
  const cloudTooltipDescription = cloudOnline
    ? 'Conectado: o sistema usa os dados da nuvem como fonte.'
    : 'Sem internet: o sistema usa o cache local (IndexedDB) neste aparelho.';

  return (
    <>
    <View style={[styles.row, inline && styles.rowInline, centered && styles.rowCentered]}>
      {showE2eShield
        ? wrapTooltip(
            inline,
            cloudTooltipTitle,
            cloudTooltipDescription,
            <View
              style={[
                btnStyle,
                {
                  borderColor: cloudColor,
                  backgroundColor: cloudOnline ? theme.gainMuted : 'rgba(220, 38, 38, 0.1)',
                },
              ]}
              accessibilityRole="image"
              accessibilityLabel={
                cloudOnline
                  ? 'Online: usando dados da nuvem'
                  : 'Offline: usando dados locais IndexedDB'
              }
            >
              {cloudOnline ? (
                <Cloud size={iconSize} color={cloudColor} strokeWidth={strokeWidth} />
              ) : (
                <CloudOff size={iconSize} color={cloudColor} strokeWidth={strokeWidth} />
              )}
            </View>,
          )
        : null}
      {showE2eShield
        ? wrapTooltip(
            inline,
            e2eTooltipTitle,
            e2eTooltipDescription,
            <PressableScale
              onPress={() => setE2eModalVisible(true)}
              style={[
                btnStyle,
                {
                  borderColor: e2eColor,
                  backgroundColor: e2eActive ? theme.gainMuted : 'rgba(220, 38, 38, 0.1)',
                },
              ]}
              accessibilityLabel={
                e2eActive
                  ? 'Criptografia ativa: NIP e nome protegidos na nuvem. Abrir detalhes.'
                  : 'Criptografia inativa. Abrir detalhes para ativar.'
              }
            >
              <Shield size={iconSize} color={e2eColor} strokeWidth={strokeWidth} />
            </PressableScale>,
          )
        : null}
      {TOP_LINKS.filter(
        (link) =>
          activeRoute !== link.route &&
          (link.route !== 'CadastroAplicador' || isBoss),
      ).map((link) => {
        const Icon = link.Icon;
        return (
          <React.Fragment key={link.route}>
            {wrapTooltip(
              inline,
              link.label,
              link.description,
              <PressableScale
                onPress={() => navigateTab(link.route)}
                style={btnStyle}
                accessibilityLabel={link.label}
              >
                <Icon size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
              </PressableScale>,
            )}
          </React.Fragment>
        );
      })}
      {activeRoute !== 'Login'
        ? wrapTooltip(
            inline,
            demoAtivo ? 'Sair do modo exemplo' : 'Dados de exemplo',
            demoAtivo
              ? 'Restaurar seus dados reais (nada vai para a nuvem no modo exemplo)'
              : `Preencher o app com ${DEMO_TOTAL_MILITARES} militares fictícios (${DEMO_TOTAL_CFN} FN, ${DEMO_TOTAL_FEMININO} mulheres) para demonstração`,
            <PressableScale
              onPress={alternarDemonstracao}
              disabled={demoCarregando}
              style={[
                btnStyle,
                demoAtivo && {
                  borderColor: theme.gain,
                  backgroundColor: theme.gainMuted,
                },
                demoCarregando ? { opacity: 0.65 } : null,
              ]}
              accessibilityLabel={demoAtivo ? 'Restaurar dados reais' : 'Carregar dados de exemplo'}
            >
              {demoCarregando ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Sparkles
                  size={iconSize}
                  color={demoAtivo ? theme.gain : tabInk}
                  strokeWidth={strokeWidth}
                />
              )}
            </PressableScale>,
          )
        : null}
      {activeRoute !== 'Login'
        ? wrapTooltip(
            inline,
            isAuthenticated ? 'Conta' : 'Entrar',
            isAuthenticated
              ? 'Sua conta Google conectada ao TAF'
              : 'Fazer login com Google',
            <PressableScale
              onPress={() => navigateTab('Login')}
              style={[
                btnStyle,
                isAuthenticated && {
                  borderColor: theme.primary,
                  backgroundColor: theme.accentMuted,
                },
              ]}
              accessibilityLabel={isAuthenticated ? 'Conta do usuário' : 'Entrar'}
            >
              <User
                size={iconSize}
                color={isAuthenticated ? theme.primary : tabInk}
                strokeWidth={strokeWidth}
              />
            </PressableScale>,
          )
        : null}
      {wrapTooltip(
        inline,
        'Configurações',
        'Ajustes, tema e dados do aplicativo',
        <PressableScale
          onPress={() => navigateTab('Configuracoes')}
          style={btnStyle}
          accessibilityLabel="Ajustes"
        >
          <Settings size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
        </PressableScale>,
      )}
    </View>
    <ConfirmacaoModoDemonstracaoModal
      visible={demoModal != null}
      phase={demoModal?.phase ?? 'confirm'}
      ativar={demoModal?.ativar ?? false}
      errorMessage={demoModal?.errorMessage}
      onClose={fecharModalDemonstracao}
      onConfirm={confirmarDemonstracao}
    />
    <E2eEncryptionStatusModal
      visible={e2eModalVisible}
      e2eActive={e2eActive}
      onClose={() => setE2eModalVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  rowInline: {
    gap: 10,
    marginTop: 0,
    marginBottom: 2,
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    overflow: 'visible',
    zIndex: 20,
  },
  rowCentered: {
    justifyContent: 'center',
    alignSelf: 'center',
  },
  btn: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});
