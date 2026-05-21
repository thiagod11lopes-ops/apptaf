import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../Card';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function StatSection({ title, subtitle, children }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
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
