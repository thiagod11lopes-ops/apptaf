import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Cloud,
  CloudOff,
  Settings,
  Shield,
  User,
  UserRoundCheck,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { navigateTab } from '../../navigation/navigationRef';
import type { AppRouteName, RootStackParamList } from '../../navigation/types';
import { useE2eEncryptionStatus } from '../../hooks/useE2eEncryptionStatus';
import { ActionIconTooltip } from './ActionIconTooltip';
import { PressableScale } from './PressableScale';
import { E2eEncryptionStatusModal } from './E2eEncryptionStatusModal';
import { SyncLiveStatusModal } from '../sismav/SyncLiveStatusModal';
import { PREMIUM } from '../../theme/premium';
import { syncManager } from '../../offline-first/sync/SyncManager';
import {
  isCloudLinkEnabled,
  subscribeCloudLink,
} from '../../offline-first/sync/cloudLinkPreference';

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
  activeRoute: AppRouteName;
  /** Layout da faixa abaixo do subtítulo na Home */
  inline?: boolean;
  /** Centraliza os ícones na faixa (Home). */
  centered?: boolean;
  /** Callback opcional: exibe botão de Resumo à esquerda do login. */
  onResumo?: () => void;
  /** Callback opcional: exibe botão de configuração de agendamento à esquerda do login. */
  onAgendamento?: () => void;
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
  onResumo,
  onAgendamento,
}: Props) {
  const { theme } = useTheme();
  const { isAuthenticated, isBoss, firebaseEnabled } = useAuth();
  const { connectivity, syncing, appMode, pendingCount, uploadError, syncUi } =
    useOfflineSyncState();
  const { e2eActive, status: e2eStatus, copy: e2eCopy } = useE2eEncryptionStatus();
  const [cloudLinkOn, setCloudLinkOn] = useState(isCloudLinkEnabled);
  useEffect(() => subscribeCloudLink(setCloudLinkOn), []);
  const networkOnline = connectivity === 'ONLINE' || connectivity === 'SYNCING';
  /** Só considera “online na nuvem” se a chave BNC estiver ligada. */
  const cloudOnline = cloudLinkOn && networkOnline;
  /** Envio ou recebimento ativo com a nuvem → ícone azul. */
  const cloudTransferring =
    cloudOnline &&
    (syncing ||
      connectivity === 'SYNCING' ||
      appMode === 'ONLINE_SYNCING' ||
      appMode === 'ONLINE_PREPARING');
  const pendingDownloads = Math.max(0, syncUi.counters.pendingDownloads ?? 0);
  const pendingUploads = Math.max(0, pendingCount, syncUi.counters.pendingUploads ?? 0);
  /**
   * Verde só quando local espelha a nuvem (sem pendência de envio nem de recebimento).
   * Qualquer divergência conhecida → âmbar.
   */
  const cloudOutOfSync =
    cloudOnline && !cloudTransferring && (pendingUploads > 0 || pendingDownloads > 0);
  const [e2eModalVisible, setE2eModalVisible] = useState(false);
  const [syncStatusModalVisible, setSyncStatusModalVisible] = useState(false);

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

  const e2eColor =
    e2eStatus === 'ready'
      ? theme.gain
      : e2eStatus === 'awaiting_boss_wrap' || e2eStatus === 'key_mismatch'
        ? theme.tokens.warning500
        : theme.loss;
  const e2eMutedBg =
    e2eStatus === 'ready'
      ? theme.gainMuted
      : e2eStatus === 'awaiting_boss_wrap' || e2eStatus === 'key_mismatch'
        ? 'rgba(245, 158, 11, 0.14)'
        : 'rgba(220, 38, 38, 0.1)';
  const e2eTooltipTitle = e2eCopy.tooltipTitle;
  const e2eTooltipDescription = e2eCopy.tooltipDescription;
  const showE2eShield = firebaseEnabled && isAuthenticated;
  const cloudColor = !cloudOnline
    ? theme.loss
    : cloudTransferring
      ? theme.primary
      : cloudOutOfSync
        ? theme.tokens.warning500
        : theme.gain;
  const cloudMutedBg = !cloudOnline
    ? 'rgba(220, 38, 38, 0.1)'
    : cloudTransferring
      ? theme.accentMuted
      : cloudOutOfSync
        ? 'rgba(245, 158, 11, 0.14)'
        : theme.gainMuted;
  const cloudPendingParts: string[] = [];
  if (pendingUploads > 0) cloudPendingParts.push(`${pendingUploads} envio(s)`);
  if (pendingDownloads > 0) cloudPendingParts.push(`${pendingDownloads} recebimento(s)`);
  const cloudTooltipTitle = !cloudLinkOn
    ? 'Desconectado · nuvem'
    : !networkOnline
      ? 'Offline · local'
      : cloudTransferring
        ? 'Sincronizando · nuvem'
        : cloudOutOfSync
          ? `Pendente · ${cloudPendingParts.join(' · ')}`
          : 'Online · igual à nuvem';
  const cloudTooltipDescription = !cloudLinkOn
    ? 'Conexão com a nuvem desligada. Ligue o BNC em Configurações para sincronizar.'
    : !networkOnline
      ? 'Sem internet — toque para ver o status. Alterações ficam no IndexedDB até reconectar.'
      : cloudTransferring
        ? 'Enviando ou recebendo dados da nuvem. Toque para ver o progresso.'
        : cloudOutOfSync
          ? uploadError
            ? `Há diferença com a nuvem. Última tentativa: ${uploadError}. Toque para sincronizar.`
            : 'Há pendência de envio ou recebimento. Toque para sincronizar até o ícone ficar verde.'
          : 'Dados deste aparelho alinhados com a nuvem. Toque para ver o status.';

  const openSyncStatus = useCallback(() => {
    setSyncStatusModalVisible(true);
    if (!isCloudLinkEnabled()) return;
    void syncManager.refreshCloudDiff({ forcePull: true }).catch(() => {});
  }, []);

  return (
    <>
    <View style={[styles.row, inline && styles.rowInline, centered && styles.rowCentered]}>
      {showE2eShield
        ? wrapTooltip(
            inline,
            cloudTooltipTitle,
            cloudTooltipDescription,
            <PressableScale
              onPress={openSyncStatus}
              style={[
                btnStyle,
                {
                  borderColor: cloudColor,
                  backgroundColor: cloudMutedBg,
                },
              ]}
              accessibilityLabel={
                !cloudLinkOn
                  ? 'Nuvem desconectada (chave desligada). Abrir status de sincronização.'
                  : !cloudOnline
                    ? 'Offline: usando dados locais IndexedDB. Abrir status de sincronização.'
                    : cloudTransferring
                      ? 'Sincronizando com a nuvem: enviando ou recebendo dados. Abrir status.'
                      : cloudOutOfSync
                        ? `Há pendência com a nuvem: ${cloudPendingParts.join(', ')}. Abrir status de sincronização.`
                        : 'Online e alinhado com a nuvem. Abrir status de sincronização.'
              }
            >
              {cloudOnline ? (
                <Cloud size={iconSize} color={cloudColor} strokeWidth={strokeWidth} />
              ) : (
                <CloudOff size={iconSize} color={cloudColor} strokeWidth={strokeWidth} />
              )}
            </PressableScale>,
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
                  backgroundColor: e2eMutedBg,
                },
              ]}
              accessibilityLabel={`${e2eCopy.tooltipTitle}. ${e2eCopy.tooltipDescription}`}
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
      {onAgendamento
        ? wrapTooltip(
            inline,
            'Agendamento',
            'Configurar disponibilidade de vagas para o TAF',
            <PressableScale
              onPress={onAgendamento}
              style={btnStyle}
              accessibilityLabel="Configurar agendamento de vagas"
            >
              <CalendarDays size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
            </PressableScale>,
          )
        : null}
      {onResumo
        ? wrapTooltip(
            inline,
            'Resumo',
            'Ver resumo geral dos testes aplicados',
            <PressableScale
              onPress={onResumo}
              style={btnStyle}
              accessibilityLabel="Resumo dos testes"
            >
              <BarChart3 size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
            </PressableScale>,
          )
        : null}
      {activeRoute !== 'Login'
        ? wrapTooltip(
            inline,
            isAuthenticated ? 'Conta' : 'Entrar',
            isAuthenticated
              ? 'Sua conta conectada ao TAF'
              : 'Fazer Login com ZIMBRA',
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
    <E2eEncryptionStatusModal
      visible={e2eModalVisible}
      e2eActive={e2eActive}
      status={e2eStatus}
      onClose={() => setE2eModalVisible(false)}
    />
    <SyncLiveStatusModal
      visible={syncStatusModalVisible}
      onClose={() => setSyncStatusModalVisible(false)}
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
