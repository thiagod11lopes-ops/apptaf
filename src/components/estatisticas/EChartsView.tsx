import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  option: unknown;
  height?: number;
  isDark?: boolean;
};

/** Fallback nativo — gráficos ECharts disponíveis na versão web. */
export function EChartsView(_props: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <Text style={[theme.textStyles.caption, { color: theme.textMuted, textAlign: 'center' }]}>
        Gráficos interativos disponíveis na versão web do aplicativo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
