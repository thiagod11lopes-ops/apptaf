import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { BookOpen, ClipboardList, Save, Settings, User, UserRoundCheck } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { navigateTab } from '../../navigation/navigationRef';
import type { RootStackParamList } from '../../navigation/types';
import { PressableScale } from './PressableScale';
import { PREMIUM } from '../../theme/premium';

const ICON_SIZE = 22;
const BTN_SIZE = PREMIUM.minTouch;

const TOP_LINKS: {
  route: keyof RootStackParamList;
  label: string;
  Icon: typeof BookOpen;
}[] = [
  { route: 'Normas', label: 'Normas', Icon: BookOpen },
  { route: 'CadastroAplicador', label: 'Aplicador de teste físico', Icon: UserRoundCheck },
  { route: 'AplicacaoTAF', label: 'Registrador de TAF', Icon: ClipboardList },
];

type Props = {
  activeRoute: keyof RootStackParamList;
  /** Layout da faixa abaixo do subtítulo na Home */
  inline?: boolean;
  /** Abre modal de sincronização com a nuvem (ícone à esquerda de Normas). */
  onSyncPress?: () => void;
  syncPendingBadge?: number;
};

export function TopActionIcons({
  activeRoute,
  inline = false,
  onSyncPress,
  syncPendingBadge = 0,
}: Props) {
  const { theme } = useTheme();
  const { isAuthenticated, isBoss } = useAuth();
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

  return (
    <View style={[styles.row, inline && styles.rowInline]}>
      {onSyncPress ? (
        <PressableScale
          onPress={onSyncPress}
          style={[btnStyle, syncPendingBadge > 0 && { borderColor: theme.primary }]}
          accessibilityLabel={
            syncPendingBadge > 0
              ? `Sincronizar com a nuvem, ${syncPendingBadge} item(ns) na fila`
              : 'Sincronizar com a nuvem'
          }
        >
          <Save size={iconSize} color={syncPendingBadge > 0 ? theme.primary : tabInk} strokeWidth={strokeWidth} />
          {syncPendingBadge > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.loss,
                  borderColor: theme.cardBg,
                },
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 2px 8px rgba(220,38,38,0.45)' } as object)
                  : { elevation: 4 },
              ]}
            >
              <Text style={styles.badgeText}>
                {syncPendingBadge > 99 ? '99+' : syncPendingBadge.toLocaleString('pt-BR')}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      ) : null}
      {TOP_LINKS.filter(
        (link) =>
          activeRoute !== link.route &&
          (link.route !== 'CadastroAplicador' || isBoss),
      ).map((link) => {
        const Icon = link.Icon;
        return (
          <PressableScale
            key={link.route}
            onPress={() => navigateTab(link.route)}
            style={btnStyle}
            accessibilityLabel={link.label}
          >
            <Icon size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
          </PressableScale>
        );
      })}
      {activeRoute !== 'Login' ? (
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
        </PressableScale>
      ) : null}
      <PressableScale
        onPress={() => navigateTab('Configuracoes')}
        style={btnStyle}
        accessibilityLabel="Ajustes"
      >
        <Settings size={iconSize} color={tabInk} strokeWidth={strokeWidth} />
      </PressableScale>
    </View>
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
    marginTop: 4,
    marginBottom: 8,
  },
  btn: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
});
