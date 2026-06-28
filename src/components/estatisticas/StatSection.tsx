import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../Card';
import { useTheme } from '../../contexts/ThemeContext';
import { isNativeMobileApp } from '../mobile/MobileScreenScaffold';
import { TafGlassPanel, TafSectionHeader } from '../mobile/TafTabChrome';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: 'cyan' | 'violet' | 'none';
};

export function StatSection({ title, subtitle, children, accent = 'none' }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const useTafChrome = isNativeMobileApp();

  if (useTafChrome) {
    return (
      <TafGlassPanel accent={accent} style={styles.card}>
        <TafSectionHeader title={title} subtitle={subtitle} />
        <View style={styles.body}>{children}</View>
      </TafGlassPanel>
    );
  }

  return (
    <Card style={styles.card} elevated>
      <Text style={ts.h2}>{title}</Text>
      {subtitle ? <Text style={[ts.caption, styles.subGap]}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  subGap: { marginTop: 6, marginBottom: 12 },
  body: { marginTop: 4 },
});
