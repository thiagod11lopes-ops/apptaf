import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PenLine, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';

export type AssinaturaAccent = 'cyan' | 'violet' | 'emerald';

const ACCENT: Record<
  AssinaturaAccent,
  { stripe: [string, string]; ring: [string, string]; glow: string }
> = {
  cyan: {
    stripe: ['#2563eb', '#38bdf8'],
    ring: ['#37bdf8', '#6366f1'],
    glow: 'rgba(56,189,248,0.22)',
  },
  violet: {
    stripe: ['#7c3aed', '#6366f1'],
    ring: ['#818cf8', '#a78bfa'],
    glow: 'rgba(99,102,241,0.24)',
  },
  emerald: {
    stripe: ['#059669', '#14b8a6'],
    ring: ['#34d399', '#2dd4bf'],
    glow: 'rgba(16,185,129,0.22)',
  },
};

function glass(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    bg: theme.isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    border: theme.isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.32)',
    highlight: theme.isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(37, 99, 235, 0.06)',
  };
}

export function AssinaturaFuturistaOverlay({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.overlay, style]}>
      <LinearGradient
        colors={['rgba(2,6,23,0.72)', 'rgba(15,23,42,0.88)']}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function AssinaturaFuturistaScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function AssinaturaFuturistaCard({
  children,
  accent = 'cyan',
  style,
}: {
  children: React.ReactNode;
  accent?: AssinaturaAccent;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const g = glass(theme);
  const a = ACCENT[accent];

  return (
    <View style={[styles.cardOuter, style]}>
      <LinearGradient colors={[...a.ring]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardRing}>
        <View style={[styles.cardInner, { backgroundColor: g.bg, borderColor: g.border }]}>
          <LinearGradient colors={[...a.stripe]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
          <LinearGradient
            colors={[a.glow, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardSheen}
            pointerEvents="none"
          />
          <View style={styles.cardBody}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

export function AssinaturaFuturistaHeader({
  kicker,
  title,
  subtitle,
  accent = 'cyan',
  onBack,
  backLabel = 'Voltar',
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  accent?: AssinaturaAccent;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const a = ACCENT[accent];

  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerTextCol}>
        {kicker ? (
          <Text style={[styles.headerKicker, { color: a.ring[0] }]}>{kicker}</Text>
        ) : null}
        <Text style={[styles.headerTitle, { color: ui.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {onBack ? (
        <TouchableOpacity
          accessibilityLabel={backLabel}
          onPress={onBack}
          activeOpacity={0.88}
          style={[styles.backBtn, { borderColor: glass(theme).border }]}
        >
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{backLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function AssinaturaFuturistaMetaChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const g = glass(theme);

  return (
    <View style={[styles.metaChip, { backgroundColor: g.highlight, borderColor: g.border }]}>
      <Text style={[styles.metaChipLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.metaChipValue, { color: ui.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function AssinaturaFuturistaCanvas({
  children,
  accent = 'cyan',
  height,
  onLayout,
  canvasProps,
}: {
  children: React.ReactNode;
  accent?: AssinaturaAccent;
  height: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  canvasProps?: {
    onStartShouldSetResponder?: () => boolean;
    onMoveShouldSetResponder?: () => boolean;
    onResponderTerminationRequest?: () => boolean;
    onResponderGrant?: (e: unknown) => void;
    onResponderMove?: (e: unknown) => void;
    onResponderRelease?: (e: unknown) => void;
    onResponderTerminate?: (e: unknown) => void;
  };
}) {
  const { theme } = useTheme();
  const a = ACCENT[accent];

  return (
    <View style={styles.canvasSection}>
      <View style={styles.canvasLabelRow}>
        <View style={[styles.canvasIconShell, { backgroundColor: a.glow }]}>
          <PenLine size={14} color={a.ring[0]} strokeWidth={2.4} />
        </View>
        <Text style={[styles.canvasLabel, { color: theme.textSecondary }]}>
          Área de assinatura — desenhe com o dedo ou mouse
        </Text>
        <Sparkles size={14} color={a.ring[1]} style={styles.canvasSpark} />
      </View>

      <LinearGradient colors={[...a.ring]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.canvasRing}>
        <View
          style={[
            styles.canvasInner,
            { height, backgroundColor: theme.isDark ? 'rgba(2,6,23,0.55)' : 'rgba(248,250,252,0.98)' },
            Platform.OS === 'web'
              ? ({ touchAction: 'none', userSelect: 'none', cursor: 'crosshair' } as object)
              : null,
          ]}
          onLayout={onLayout}
          {...canvasProps}
        >
          <LinearGradient
            colors={
              theme.isDark
                ? ['rgba(56,189,248,0.06)', 'transparent']
                : ['rgba(37,99,235,0.05)', 'transparent']
            }
            style={styles.canvasGridSheen}
            pointerEvents="none"
          />
          {children}
          <Text style={[styles.canvasWatermark, { color: theme.textMuted }]} pointerEvents="none">
            ASSINATURA
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export function AssinaturaFuturistaError({ message }: { message: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.erro, { color: theme.loss }]}>{message}</Text>;
}

export function AssinaturaFuturistaBtnRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.footerBtns}>{children}</View>;
}

export function AssinaturaFuturistaBtnGhost({
  label,
  onPress,
  flex,
}: {
  label: string;
  onPress: () => void;
  flex?: boolean;
}) {
  const { theme } = useTheme();
  const g = glass(theme);

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.btnGhost,
        flex ? styles.btnFlex : null,
        { borderColor: g.border, backgroundColor: g.highlight },
      ]}
    >
      <Text style={[styles.btnGhostText, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AssinaturaFuturistaBtnPrimary({
  label,
  onPress,
  disabled,
  loading,
  accent = 'cyan',
  flex,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accent?: AssinaturaAccent;
  flex?: boolean;
}) {
  const { theme } = useTheme();
  const a = ACCENT[accent];
  const off = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.9}
      style={[styles.btnPrimaryWrap, flex ? styles.btnFlex : null, off ? styles.btnDisabled : null]}
    >
      <LinearGradient
        colors={off ? (theme.isDark ? ['#334155', '#1e293b'] : ['#cbd5e1', '#94a3b8']) : [...a.stripe]}
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

export function AssinaturaFuturistaFieldLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{children}</Text>;
}

export function assinaturaFuturistaInputStyle(theme: ReturnType<typeof useTheme>['theme']) {
  const g = glass(theme);
  return [
    styles.input,
    {
      borderColor: g.border,
      backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.65)',
      color: theme.text,
    },
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
  ];
}

export function AssinaturaFuturistaSelectList({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const g = glass(theme);

  return (
    <View style={[styles.selectList, { borderColor: g.border, backgroundColor: g.highlight }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px)' } as object) : null),
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  cardRing: {
    borderRadius: PREMIUM.radiusLg + 6,
    padding: 1.5,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 64px rgba(15,23,42,0.32)' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.28,
          shadowRadius: 28,
          elevation: 14,
        }),
  },
  cardInner: {
    borderRadius: PREMIUM.radiusLg + 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardStripe: {
    height: 3,
    width: '100%',
  },
  cardSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.9,
  },
  cardBody: {
    padding: 20,
    gap: 4,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 2,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    marginBottom: 12,
  },
  metaChipLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaChipValue: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  canvasSection: {
    gap: 8,
    marginBottom: 12,
  },
  canvasLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  canvasIconShell: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  canvasLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  canvasSpark: {
    flexShrink: 0,
    opacity: 0.75,
  },
  canvasRing: {
    borderRadius: PREMIUM.radiusMd + 4,
    padding: 2,
  },
  canvasInner: {
    borderRadius: PREMIUM.radiusMd + 2,
    overflow: 'hidden',
    position: 'relative',
  },
  canvasGridSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  canvasWatermark: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
    opacity: 0.35,
  },
  erro: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  footerBtns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  btnGhost: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '800',
  },
  btnPrimaryWrap: {
    borderRadius: PREMIUM.radiusMd + 2,
    overflow: 'hidden',
    minWidth: 120,
  },
  btnFlex: {
    flex: 1,
    minWidth: 0,
  },
  btnPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectList: {
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
});
