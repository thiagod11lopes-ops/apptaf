import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  style?: ViewStyle;
  noBodyPadding?: boolean;
};

export function SectionCard({ title, children, actions, style, noBodyPadding }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowCard } as object) : { elevation: 2 },
        style,
      ]}
    >
      <LinearGradient
        colors={[...t.gradientHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{title}</Text>
        {actions ? <View style={styles.headerActions}>{actions}</View> : null}
      </LinearGradient>
      <LinearGradient
        colors={[...t.gradientPanelBody]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.body, noBodyPadding && styles.bodyFlush]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  body: {
    padding: 16,
  },
  bodyFlush: {
    padding: 0,
  },
});
