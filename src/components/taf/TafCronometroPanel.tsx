import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pause, Play, Timer } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { PressableScale } from '../premium/PressableScale';
import type { TafCronometroEstado } from '../../hooks/useTafReactStopwatch';

export type { TafCronometroEstado };

type StatusMeta = {
  label: string;
  dotColor: string;
  pillBg: string;
  pillText: string;
};

function statusMeta(estado: TafCronometroEstado, theme: ReturnType<typeof useTheme>['theme']): StatusMeta {
  switch (estado) {
    case 'rodando':
      return {
        label: 'Em andamento',
        dotColor: theme.success,
        pillBg: theme.isDark ? 'rgba(34, 197, 94, 0.18)' : 'rgba(22, 163, 74, 0.12)',
        pillText: theme.isDark ? '#86efac' : '#15803d',
      };
    case 'pausado':
      return {
        label: 'Pausado',
        dotColor: '#f59e0b',
        pillBg: theme.isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.14)',
        pillText: theme.isDark ? '#fcd34d' : '#b45309',
      };
    case 'finalizado':
      return {
        label: 'Encerrado',
        dotColor: theme.primary,
        pillBg: theme.isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)',
        pillText: theme.isDark ? '#93c5fd' : theme.primary,
      };
    default:
      return {
        label: 'Pronto',
        dotColor: theme.textMuted,
        pillBg: theme.isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.1)',
        pillText: theme.textSecondary,
      };
  }
}

export type TafCronometroPanelProps = {
  tituloProva: string;
  tempoExibido: string;
  estado: TafCronometroEstado;
  pausadoTexto: string;
  onPausadoTextoChange: (text: string) => void;
  onBlurPausado: () => void;
  onIniciar: () => void;
  /** Mantido por compatibilidade; o botão Parar foi removido da UI. */
  onParar?: () => void;
  onPausar: () => void;
  onContinuar: () => void;
  hint?: string;
  footer?: React.ReactNode;
  /** Modal de prova: só display + controles integrados, sem cabeçalho extra. */
  variant?: 'full' | 'compact';
};

export function TafCronometroPanel({
  tituloProva,
  tempoExibido,
  estado,
  pausadoTexto,
  onPausadoTextoChange,
  onBlurPausado,
  onIniciar,
  onPausar,
  onContinuar,
  hint,
  footer,
  variant = 'full',
}: TafCronometroPanelProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const status = statusMeta(estado, theme);
  const compact = variant === 'compact';

  const displayColor =
    estado === 'rodando'
      ? theme.isDark
        ? '#4ade80'
        : '#16a34a'
      : estado === 'pausado'
        ? theme.isDark
          ? '#fbbf24'
          : '#d97706'
        : theme.isDark
          ? '#f8fafc'
          : '#0f172a';

  const displayShellBg = theme.isDark ? '#0b1220' : '#0f172a';
  const displayShellBorder = theme.isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.85)';

  const monoWeb = Platform.OS === 'web' ? ({ fontVariantNumeric: 'tabular-nums' } as object) : null;

  const splitTempo = (() => {
    const parts = (estado === 'pausado' ? pausadoTexto : tempoExibido).split(':');
    if (parts.length >= 3) {
      return { mm: parts[0] || '00', ss: parts[1] || '00', cs: parts[2] || '00' };
    }
    if (parts.length === 2) {
      return { mm: parts[0] || '00', ss: parts[1] || '00', cs: '00' };
    }
    return { mm: '00', ss: '00', cs: '00' };
  })();

  const digitBlock = (value: string, label: string) => (
    <View style={styles.digitBlock}>
      <Text
        style={[
          compact ? styles.digitValueCompact : styles.digitValue,
          { color: displayColor },
          monoWeb,
        ]}
      >
        {value.padStart(2, '0')}
      </Text>
      <Text style={styles.digitLabel}>{label}</Text>
    </View>
  );

  const timeNode =
    estado === 'pausado' ? (
      <TextInput
        value={pausadoTexto}
        onChangeText={onPausadoTextoChange}
        onBlur={onBlurPausado}
        selectTextOnFocus
        accessibilityLabel="Editar tempo do cronômetro pausado"
        placeholder="MM:SS:CS"
        placeholderTextColor="rgba(148, 163, 184, 0.65)"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        {...(Platform.OS === 'ios' ? { textContentType: 'none' as const } : {})}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        style={[
          compact ? styles.displayInputCompact : styles.displayInput,
          { color: displayColor },
          monoWeb,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
    ) : (
      <View style={styles.digitsRow} accessibilityLabel={`Tempo ${tempoExibido}`}>
        {digitBlock(splitTempo.mm, 'min')}
        <Text style={[compact ? styles.digitSepCompact : styles.digitSep, { color: displayColor }]}>
          :
        </Text>
        {digitBlock(splitTempo.ss, 'seg')}
        <Text style={[compact ? styles.digitSepCompact : styles.digitSep, { color: displayColor }]}>
          :
        </Text>
        {digitBlock(splitTempo.cs, 'cs')}
      </View>
    );

  const rodando = estado === 'rodando';
  const toggleLabel = rodando ? 'Pausar' : 'Iniciar';
  const toggleA11y = rodando
    ? 'Pausar cronômetro'
    : estado === 'pausado'
      ? 'Retomar cronômetro'
      : `Iniciar ${tituloProva}`;
  const onTogglePress = rodando
    ? onPausar
    : estado === 'pausado'
      ? onContinuar
      : onIniciar;
  const toggleColors: [string, string, string] = rodando
    ? ['#f59e0b', '#f97316', '#ef4444']
    : ['#22d3ee', '#10b981', '#059669'];
  const toggleGlow = rodando
    ? '0 8px 28px rgba(249, 115, 22, 0.45), 0 0 0 1px rgba(251, 191, 36, 0.35)'
    : '0 8px 28px rgba(16, 185, 129, 0.42), 0 0 0 1px rgba(45, 212, 191, 0.35)';

  const controlsNode = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={toggleA11y}
      onPress={onTogglePress}
      style={[
        compact ? styles.toggleOuterCompact : styles.toggleOuter,
        Platform.OS === 'web' ? ({ boxShadow: toggleGlow } as object) : null,
      ]}
    >
      <LinearGradient
        colors={toggleColors}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={compact ? styles.toggleGradientCompact : styles.toggleGradient}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={compact ? styles.toggleIconWrapCompact : styles.toggleIconWrap}>
          {rodando ? (
            <Pause
              size={compact ? 16 : 20}
              color="#FFFFFF"
              strokeWidth={2.8}
              fill="#FFFFFF"
            />
          ) : (
            <Play
              size={compact ? 16 : 20}
              color="#FFFFFF"
              strokeWidth={2.6}
              fill="#FFFFFF"
            />
          )}
        </View>
        <Text style={compact ? styles.toggleLabelCompact : styles.toggleLabel}>
          {compact ? toggleLabel : rodando ? 'Pausar' : `Iniciar ${tituloProva}`}
        </Text>
      </LinearGradient>
    </PressableScale>
  );

  if (compact) {
    return (
      <View style={[styles.shellCompact, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
        <View
          style={[
            styles.displayShellCompact,
            {
              backgroundColor: displayShellBg,
              borderColor: displayShellBorder,
            },
          ]}
        >
          <View style={styles.compactMergedRow}>
            <View style={styles.compactTitleCol}>
              <Text style={styles.compactKicker} numberOfLines={1}>
                PROVA ATIVA
              </Text>
              <Text style={styles.compactTitulo} numberOfLines={2}>
                {tituloProva} preparada
              </Text>
            </View>
            <View style={styles.compactTimeCol}>{timeNode}</View>
            <View style={styles.compactControlsCol}>{controlsNode}</View>
          </View>
        </View>
        {hint ? <Text style={[styles.hintCompact, { color: theme.textMuted }]}>{hint}</Text> : null}
        {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
        },
        Platform.OS === 'web' ? ({ boxShadow: theme.tokens.shadowMd } as object) : null,
      ]}
    >
      <LinearGradient
        colors={
          theme.isDark
            ? ['rgba(59, 130, 246, 0.22)', 'rgba(15, 23, 42, 0.05)']
            : ['rgba(37, 99, 235, 0.08)', 'rgba(255, 255, 255, 0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shellGradient}
      />

      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={[styles.iconBadge, { backgroundColor: theme.isDark ? 'rgba(59,130,246,0.2)' : PREMIUM.accentMuted }]}>
            <Timer size={18} color={theme.primary} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>CRONÔMETRO</Text>
            <Text style={[styles.provaTitulo, { color: ui.text }]}>{tituloProva}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.pillBg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
          <Text style={[styles.statusText, { color: status.pillText }]}>{status.label}</Text>
        </View>
      </View>

      <View
        style={[
          styles.displayShell,
          {
            backgroundColor: displayShellBg,
            borderColor: displayShellBorder,
          },
        ]}
      >
        {timeNode}
        <Text style={styles.displayHint}>min · seg · centésimos</Text>
      </View>

      {controlsNode}

      {hint ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
      ) : null}

      {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginTop: 18,
    borderRadius: PREMIUM.radiusLg + 4,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    gap: 14,
  },
  shellGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  provaTitulo: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  displayShell: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 118,
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  digitBlock: {
    alignItems: 'center',
    minWidth: Platform.select({ web: 56, default: 44 }),
  },
  digitValue: {
    fontSize: Platform.select({ web: 48, default: 40 }),
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: Platform.select({ web: 54, default: 46 }),
  },
  digitValueCompact: {
    fontSize: Platform.select({ web: 26, default: 22 }),
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: Platform.select({ web: 30, default: 26 }),
  },
  digitLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(148, 163, 184, 0.85)',
  },
  digitSep: {
    fontSize: Platform.select({ web: 42, default: 36 }),
    fontWeight: '800',
    marginBottom: 14,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  digitSepCompact: {
    fontSize: Platform.select({ web: 22, default: 18 }),
    fontWeight: '800',
    marginBottom: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  displayText: {
    fontSize: Platform.select({ web: 56, default: 48 }),
    fontWeight: '800',
    letterSpacing: Platform.select({ web: 3, default: 2 }),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: Platform.select({ web: 62, default: 54 }),
  },
  displayInput: {
    fontSize: Platform.select({ web: 40, default: 32 }),
    fontWeight: '800',
    letterSpacing: Platform.select({ web: 2, default: 1 }),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    minWidth: 200,
    textAlign: 'center',
    padding: 0,
    borderWidth: 0,
  },
  displayHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: 'rgba(148, 163, 184, 0.85)',
    textTransform: 'uppercase',
  },
  displayInputCompact: {
    fontSize: Platform.select({ web: 22, default: 18 }),
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
    borderWidth: 0,
  },
  displayTextCompact: {
    fontSize: Platform.select({ web: 32, default: 28 }),
    fontWeight: '800',
    letterSpacing: Platform.select({ web: 2, default: 1.5 }),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: Platform.select({ web: 36, default: 32 }),
  },
  toggleOuter: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  toggleOuterCompact: {
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 104,
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    overflow: 'hidden',
  },
  toggleGradientCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  toggleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  toggleIconWrapCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(15, 23, 42, 0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  toggleLabelCompact: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSlot: {
    width: '100%',
  },
  shellCompact: {
    width: '100%',
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  displayShellCompact: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  compactMergedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactTitleCol: {
    flexShrink: 1,
    maxWidth: '34%',
    minWidth: 88,
    justifyContent: 'center',
    gap: 2,
    paddingRight: 2,
  },
  compactKicker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: 'rgba(148, 163, 184, 0.95)',
  },
  compactTitulo: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
    color: '#f8fafc',
  },
  compactTimeCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactControlsCol: {
    flexShrink: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  hintCompact: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
