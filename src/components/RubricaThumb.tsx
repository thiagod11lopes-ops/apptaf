import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  svgUri?: string | null;
  width?: number;
  height?: number;
};

/** Miniatura da rúbrica (SVG em data URL). */
export function RubricaThumb({ svgUri, width = 120, height = 44 }: Props) {
  const { theme } = useTheme();
  if (!svgUri?.trim()) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          width,
          height,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
      ]}
    >
      <Image
        source={{ uri: svgUri }}
        style={{ width: width - 4, height: height - 4 }}
        resizeMode="contain"
        accessibilityLabel="Rúbrica do candidato"
      />
    </View>
  );
}

export function RubricaThumbPlaceholder({ label = 'Sem rúbrica' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.placeholder, { borderColor: theme.border }]}>
      <Text style={[styles.placeholderText, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
