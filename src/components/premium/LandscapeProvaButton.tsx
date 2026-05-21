import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { RotateCw, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { PressableScale } from './PressableScale';

type Props = {
  tituloProva: string;
  onPress: () => void;
  loading?: boolean;
};

export function LandscapeProvaButton({ tituloProva, onPress, loading }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      style={[
        styles.wrap,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.primary,
          opacity: loading ? 0.7 : 1,
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: `0 12px 40px ${theme.isDark ? 'rgba(107,124,255,0.25)' : 'rgba(107,124,255,0.2)'}`,
            } as object)
          : { elevation: 6 },
      ]}
      accessibilityLabel={`Girar tela para modo paisagem e iniciar ${tituloProva}`}
    >
      <View style={[styles.iconRing, { backgroundColor: theme.accentMuted }]}>
        <RotateCw size={32} color={theme.primary} strokeWidth={2.2} />
      </View>
      <Text style={[ts.h2, styles.title, { color: theme.text }]}>Girar tela (paisagem)</Text>
      <Text style={[ts.bodySecondary, styles.sub, { color: theme.textSecondary }]}>
        Toque para deitar a tela e ver a tabela de {tituloProva} com mais espaço
      </Text>
      <View style={[styles.chip, { backgroundColor: theme.primary }]}>
        <Smartphone size={16} color="#FFFFFF" strokeWidth={2.2} />
        <Text style={styles.chipText}>Iniciar {tituloProva} em paisagem</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: PREMIUM.radiusXl,
    borderWidth: 2,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
  },
  sub: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: PREMIUM.radiusMd,
    marginTop: 4,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
