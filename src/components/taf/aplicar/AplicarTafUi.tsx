import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { aplicarTafShared, getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';

export function AplicarTafTabHeader({
  title,
  subtitle,
  kicker,
  onBack,
  right,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  centered?: boolean;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = getUiColors(theme);
  const { isNativeMobile, isNarrowPhone } = useAplicarTafLayout();
  const glass = getAplicarTafGlass(theme);

  if (centered) {
    return (
      <View style={styles.headerCenteredWrap}>
        <View style={styles.headerCenteredText}>
          <Text
            style={[
              ts.brandTitle,
              styles.headerTitleCentered,
              {
                fontSize: isNarrowPhone ? 26 : 28,
                lineHeight: isNarrowPhone ? 32 : 34,
              },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {title}
          </Text>
          <LinearGradient
            colors={[theme.primary, '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerTitleRule}
          />
          {subtitle ? (
            <Text
              style={[styles.headerSubtitle, styles.headerSubtitleCentered, { color: theme.textSecondary }]}
              numberOfLines={3}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.headerCenteredFooter}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.headerWrap, right ? styles.headerWrapWithRight : null]}>
      {onBack ? (
        <TouchableOpacity
          accessibilityLabel="Voltar"
          onPress={onBack}
          activeOpacity={0.88}
          style={[styles.backBtn, { borderColor: glass.border }]}
        >
          <ChevronLeft size={22} color={ui.iconStrong} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.headerTextCol, !onBack ? styles.headerTextColExpanded : null]}>
        {kicker ? (
          <Text style={[styles.headerKicker, { color: theme.primary }]} numberOfLines={1}>
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[
            styles.headerTitle,
            {
              color: ui.text,
              fontSize: isNarrowPhone ? 22 : isNativeMobile ? 24 : 26,
              lineHeight: isNarrowPhone ? 26 : isNativeMobile ? 28 : 30,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function AplicarTafFlowHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return <AplicarTafTabHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />;
}

export function AplicarTafCenteredTabHeader({
  title,
  subtitle,
  footer,
}: {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}) {
  return <AplicarTafTabHeader title={title} subtitle={subtitle} centered right={footer} />;
}

export function AplicarTafGlassPanel({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: 'cyan' | 'violet' | 'none';
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);
  const { isNativeMobile } = useAplicarTafLayout();
  const accentColor =
    accent === 'violet'
      ? theme.isDark
        ? '#818cf8'
        : '#6366f1'
      : accent === 'cyan'
        ? theme.isDark
          ? '#38bdf8'
          : '#0ea5e9'
        : 'transparent';

  return (
    <View style={[styles.panelOuter, style]}>
      {accent && accent !== 'none' ? (
        <LinearGradient
          colors={[accentColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panelAccent}
        />
      ) : null}
      <View
        style={[
          styles.panelInner,
          { padding: isNativeMobile ? 14 : 18 },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px)' } as object) : null,
          {
            backgroundColor: glass.bg,
            borderColor: glass.border,
          },
          Platform.OS !== 'web'
            ? {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: theme.isDark ? 0.35 : 0.08,
                shadowRadius: 24,
                elevation: 8,
              }
            : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function AplicarTafSectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const { isNativeMobile, isNarrowPhone } = useAplicarTafLayout();

  return (
    <View style={styles.sectionHeader}>
      {kicker ? (
        <Text style={[styles.sectionKicker, { color: theme.primary }]}>{kicker}</Text>
      ) : null}
      <Text
        style={[
          styles.sectionTitle,
          {
            color: ui.text,
            fontSize: isNarrowPhone ? 18 : isNativeMobile ? 19 : 20,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function AplicarTafBackLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.backLink}
    >
      <ChevronLeft size={16} color={theme.textSecondary} strokeWidth={2.5} />
      <Text style={[styles.backLinkText, { color: theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AplicarTafPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'outline';
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);

  if (variant === 'outline' || variant === 'ghost') {
    return (
      <TouchableOpacity
        accessibilityLabel={label}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={[
          styles.btnOutline,
          {
            borderColor: glass.border,
            backgroundColor: variant === 'ghost' ? 'transparent' : glass.highlight,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.btnOutlineText, { color: theme.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
      style={[
        styles.btnPrimaryWrap,
        disabled ? styles.btnDisabled : null,
        Platform.OS === 'web' ? ({ boxShadow: '0 0 32px rgba(56,189,248,0.18)' } as object) : null,
      ]}
    >
      <LinearGradient
        colors={
          disabled
            ? theme.isDark
              ? ['#334155', '#1e293b']
              : ['#cbd5e1', '#94a3b8']
            : [theme.primary, '#6366f1']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btnPrimary}
      >
        <Text style={[styles.btnPrimaryText, { color: theme.tokens.textOnPrimary }]}>
          {loading ? '…' : label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function AplicarTafInput(props: TextInputProps) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);

  return (
    <TextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? ui.placeholder}
      style={[
        styles.input,
        {
          borderColor: glass.border,
          backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.65)',
          color: ui.text,
        },
        props.style,
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerWrapWithRight: {
    marginBottom: 20,
  },
  headerCenteredWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 8,
    ...(Platform.OS === 'web' ? ({ overflow: 'visible' as const, zIndex: 10 } as object) : null),
  },
  headerTitleRule: {
    width: 32,
    height: 2,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 2,
  },
  headerCenteredText: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  headerCenteredFooter: {
    width: '100%',
    alignItems: 'center',
  },
  headerTitleCentered: {
    textAlign: 'center',
    width: '100%',
  },
  headerSubtitleCentered: {
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTextColExpanded: {
    paddingRight: 4,
  },
  headerRight: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  panelOuter: {
    width: '100%',
    marginBottom: 16,
    borderRadius: PREMIUM.radiusLg + 4,
    overflow: 'hidden',
  },
  panelAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  panelInner: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg + 4,
    gap: 4,
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 16,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 2,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: 14,
    paddingVertical: 4,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnPrimaryWrap: {
    width: '100%',
    borderRadius: PREMIUM.radiusMd + 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnPrimary: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  btnOutline: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
