import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../Card';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  textColor: string;
  mutedColor: string;
};

export function StatSection({ title, subtitle, children, textColor, mutedColor }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  body: { marginTop: 8 },
});
