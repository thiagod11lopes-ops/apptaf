import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../Card';
import { useTheme } from '../../contexts/ThemeContext';
import { FINTECH } from '../../theme/fintech';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function StatSection({ title, subtitle, children }: Props) {
  const { theme } = useTheme();
  return (
    <Card style={styles.card} elevated>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, marginBottom: 12, lineHeight: 17 },
  body: { marginTop: 8 },
});
