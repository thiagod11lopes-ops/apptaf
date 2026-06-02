import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';
import { FONT_BRAND, FONT_BRAND_SUB } from '../../theme/typography';
import { PREMIUM } from '../../theme/premium';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  darkHero?: boolean;
  onBack?: () => void;
};

export function AppHeader({ title, subtitle, right, darkHero, onBack }: Props) {
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
          {onBack ? (
            <PressableScale onPress={onBack} style={styles.sideSlot} accessibilityLabel="Voltar">
              <View style={[styles.backCircle, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </PressableScale>
          ) : (
            <View style={styles.sideSlot} />
          )}
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { fontFamily: FONT_BRAND }]}>{title}</Text>
            <View style={[styles.rule, styles.ruleCentered, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
            {subtitle ? (
              <Text style={[styles.heroSub, { fontFamily: FONT_BRAND_SUB }]}>{subtitle}</Text>
            ) : null}
          </View>
          <View style={styles.sideSlot}>{right}</View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.wrap}>
      {onBack ? (
        <PressableScale onPress={onBack} style={styles.sideSlot} accessibilityLabel="Voltar">
          <View style={[styles.backCircle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
          </View>
        </PressableScale>
      ) : (
        <View style={styles.sideSlot} />
      )}
      <View style={styles.textCol}>
        <Text style={[theme.textStyles.brandTitle, styles.titleCenter, isDark && styles.titleOnDark]}>
          {title}
        </Text>
        <LinearGradient
          colors={[t.primary600, t.primary300]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rule, styles.ruleCentered]}
        />
        {subtitle ? (
          <Text style={[theme.textStyles.brandSubtitle, styles.subtitleCenter]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.sideSlot}>{right}</View>
    </View>
  );
}

const SIDE_SLOT = PREMIUM.minTouch;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  sideSlot: {
    width: SIDE_SLOT,
    minHeight: SIDE_SLOT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleCenter: { textAlign: 'center', width: '100%' },
  subtitleCenter: { textAlign: 'center', width: '100%' },
  titleOnDark: { color: '#f1f5f9' },
  rule: {
    width: 28,
    height: 2,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  ruleCentered: { alignSelf: 'center' },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  heroText: { flex: 1, alignItems: 'center' },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
    width: '100%',
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
  },
});
