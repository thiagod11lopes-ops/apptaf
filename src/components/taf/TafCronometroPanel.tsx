import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pause, Play, Timer } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';

export type TafCronometroEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

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
  onParar: () => void;
  onPausar: () => void;
  onContinuar: () => void;
  hint?: string;
  footer?: React.ReactNode;
};

export function TafCronometroPanel({
  tituloProva,
  tempoExibido,
  estado,
  pausadoTexto,
  onPausadoTextoChange,
  onBlurPausado,
  onIniciar,
  onParar,
  onPausar,
  onContinuar,
  hint,
  footer,
}: TafCronometroPanelProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const status = statusMeta(estado, theme);

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
        {estado === 'pausado' ? (
          <TextInput
            value={pausadoTexto}
            onChangeText={onPausadoTextoChange}
            onBlur={onBlurPausado}
            selectTextOnFocus
            accessibilityLabel="Editar tempo do cronômetro pausado"
            placeholder="MM:SS"
            placeholderTextColor="rgba(148, 163, 184, 0.65)"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            {...(Platform.OS === 'ios' ? { textContentType: 'none' as const } : {})}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            style={[
              styles.displayInput,
              { color: displayColor },
              monoWeb,
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
          />
        ) : (
          <Text style={[styles.displayText, { color: displayColor }, monoWeb]}>{tempoExibido}</Text>
        )}
        <Text style={styles.displayHint}>tempo oficial da prova</Text>
      </View>

      <View style={styles.controlsRow}>
        {estado === 'inicial' || estado === 'finalizado' ? (
          <TouchableOpacity
            accessibilityLabel={`Iniciar ${tituloProva}`}
            activeOpacity={0.88}
            onPress={onIniciar}
            style={[styles.btnPrimary, { backgroundColor: theme.primary }]}
          >
            <Play size={18} color={theme.tokens.textOnPrimary} strokeWidth={2.6} fill={theme.tokens.textOnPrimary} />
            <Text style={[styles.btnPrimaryText, { color: theme.tokens.textOnPrimary }]}>
              Iniciar {tituloProva}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              accessibilityLabel={estado === 'pausado' ? 'Continuar cronômetro' : 'Pausar cronômetro'}
              activeOpacity={0.88}
              onPress={estado === 'pausado' ? onContinuar : onPausar}
              style={[
                styles.btnIcon,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            >
              {estado === 'pausado' ? (
                <Play size={22} color={ui.iconStrong} strokeWidth={2.5} fill={ui.iconStrong} />
              ) : (
                <Pause size={22} color={ui.iconStrong} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={`Parar ${tituloProva}`}
              activeOpacity={0.88}
              onPress={onParar}
              style={[styles.btnStop, { backgroundColor: ui.btnDarkBg, borderColor: theme.border }]}
            >
              <Text style={styles.btnStopText}>Parar {tituloProva}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

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
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 118,
  },
  displayText: {
    fontSize: Platform.select({ web: 56, default: 48 }),
    fontWeight: '800',
    letterSpacing: Platform.select({ web: 3, default: 2 }),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: Platform.select({ web: 62, default: 54 }),
  },
  displayInput: {
    fontSize: Platform.select({ web: 56, default: 48 }),
    fontWeight: '800',
    letterSpacing: Platform.select({ web: 3, default: 2 }),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    minWidth: 180,
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusMd + 2,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnIcon: {
    width: 56,
    minHeight: 52,
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStop: {
    flex: 1,
    minHeight: 52,
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnStopText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSlot: {
    width: '100%',
  },
});
