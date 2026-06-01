import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_BRAND, FONT_BRAND_SUB } from '../../theme/typography';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  darkHero?: boolean;
};

export function AppHeader({ title, subtitle, right, darkHero }: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;

  if (darkHero) {
    return (
      <LinearGradient
        colors={[...t.gradientHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { fontFamily: FONT_BRAND }]}>{title}</Text>
            <View style={styles.rule} />
            {subtitle ? (
              <Text style={[styles.heroSub, { fontFamily: FONT_BRAND_SUB }]}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <Text style={[theme.textStyles.brandTitle, isDark && styles.titleOnDark]}>{title}</Text>
        <LinearGradient
          colors={[t.primary600, t.primary300]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rule}
        />
        {subtitle ? (
          <Text style={theme.textStyles.brandSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  textCol: { flex: 1 },
  titleOnDark: { color: '#f1f5f9' },
  rule: {
    width: 28,
    height: 2,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  right: { alignItems: 'flex-end' },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroText: { flex: 1 },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 8,
  },
});
