import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudUpload, WifiOff } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';
import { PREMIUM } from '../../theme/premium';

type Props = {
  offline: boolean;
  pendingCount: number;
  forcedOffline?: boolean;
  onPressSync?: () => void;
};

export function OfflineStatusBanner({ offline, pendingCount, forcedOffline = false, onPressSync }: Props) {
  const { theme } = useTheme();

  if (!offline && pendingCount <= 0) return null;

  const isOfflineMode = offline;
  const Icon = isOfflineMode ? WifiOff : CloudUpload;
  const title = forcedOffline
    ? 'Modo offline controlado'
    : isOfflineMode && pendingCount > 0
      ? `${pendingCount} alteração${pendingCount !== 1 ? 'ões' : ''} locais pendentes`
      : isOfflineMode
        ? 'Modo offline'
        : `${pendingCount} alteração${pendingCount !== 1 ? 'ões' : ''} aguardando nuvem`;
  const subtitle = forcedOffline
    ? 'Todos os dados estão neste dispositivo. Toque para voltar ao modo online.'
    : isOfflineMode
      ? pendingCount > 0
        ? 'Dados da nuvem salvos localmente. Edite à vontade; envie pelo modal ao reconectar.'
        : 'Dados da nuvem salvos neste dispositivo. Você pode ver e editar normalmente.'
      : 'Toque para enviar as atualizações deste dispositivo à nuvem.';

  const colors = isOfflineMode
    ? (['#451a03', '#92400e'] as const)
    : (['#1e3a8a', '#2563eb'] as const);

  const content = (
    <LinearGradient
      colors={[...colors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.banner,
        Platform.OS === 'web' ? ({ boxShadow: '0 4px 16px rgba(15, 23, 42, 0.15)' } as object) : undefined,
      ]}
    >
      <View style={styles.iconWrap}>
        <Icon size={18} color="#FFFFFF" strokeWidth={2.5} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {!isOfflineMode && onPressSync ? (
        <View style={styles.actionChip}>
          <Text style={styles.actionText}>Sincronizar</Text>
        </View>
      ) : null}
      {forcedOffline && onPressSync ? (
        <View style={styles.actionChip}>
          <Text style={styles.actionText}>Online</Text>
        </View>
      ) : null}
      {!forcedOffline && isOfflineMode && pendingCount > 0 && onPressSync ? (
        <View style={styles.actionChip}>
          <Text style={styles.actionText}>Enviar</Text>
        </View>
      ) : null}
    </LinearGradient>
  );

  if ((!isOfflineMode || forcedOffline || pendingCount > 0) && onPressSync) {
    return (
      <PressableScale onPress={onPressSync} style={styles.wrap}>
        {content}
      </PressableScale>
    );
  }

  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusLg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  actionChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
