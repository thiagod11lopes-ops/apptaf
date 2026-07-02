import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { PREMIUM } from '../../../theme/premium';

type Props = {
  onPress: () => void;
  loading?: boolean;
};

export function AplicarTafDemoNipsIconButton({ onPress, loading = false }: Props) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="Preencher NIPs de exemplo"
      accessibilityHint="Preenche automaticamente os NIPs dos participantes com militares fictícios do modo demonstração"
      onPress={onPress}
      disabled={loading}
      style={[
        styles.btn,
        {
          borderColor: theme.gain,
          backgroundColor: theme.gainMuted,
          opacity: loading ? 0.65 : 1,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: '0 4px 14px rgba(22,163,74,0.22)' } as object)
          : { elevation: 4 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.gain} />
      ) : (
        <Sparkles size={20} color={theme.gain} strokeWidth={2.3} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
