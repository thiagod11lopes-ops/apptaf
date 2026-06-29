import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Waves,
  Timer,
  Dumbbell,
  Activity,
  Shield,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';
import { CorridaRunnerIcon } from './CorridaRunnerIcon';
import type { TipoProvaTAF } from '../../../taf/tafProvaTypes';

type ProvaConfig = {
  id: TipoProvaTAF;
  label: string;
  icon: LucideIcon | 'corrida-runner';
  colors: [string, string];
};

const CORRIDA: ProvaConfig = {
  id: 'corrida',
  label: 'Corrida',
  icon: 'corrida-runner',
  colors: ['#2563eb', '#38bdf8'],
};
const NATACAO: ProvaConfig = {
  id: 'natacao',
  label: 'Natação',
  icon: Waves,
  colors: ['#0891b2', '#6366f1'],
};
const PERMANENCIA: ProvaConfig = {
  id: 'permanencia',
  label: 'Permanência',
  icon: Timer,
  colors: ['#7c3aed', '#4f46e5'],
};
const CAMINHADA: ProvaConfig = {
  id: 'caminhada',
  label: 'Caminhada',
  icon: Activity,
  colors: ['#059669', '#14b8a6'],
};

const CORRIDA_3200: ProvaConfig = {
  id: 'corrida',
  label: 'Corrida 3200 m',
  icon: 'corrida-runner',
  colors: ['#4a5c38', '#6b5c45'],
};
const NATACAO_100: ProvaConfig = {
  id: 'natacao',
  label: 'Natação 100 m',
  icon: Waves,
  colors: ['#3d4a28', '#5c4a32'],
};
const PERMANENCIA_NAVAL: ProvaConfig = {
  id: 'permanencia',
  label: 'Permanência',
  icon: Timer,
  colors: ['#556B2F', '#4a5530'],
};
const FLEXAO_BARRA: ProvaConfig = {
  id: 'flexao_barra',
  label: 'Flexão na barra',
  icon: Dumbbell,
  colors: ['#3a4d28', '#5a6b42'],
};
const FLEXAO_SOLO: ProvaConfig = {
  id: 'flexao_solo',
  label: 'Flexão no solo',
  icon: Dumbbell,
  colors: ['#4a5530', '#7a6344'],
};
const ABDOMINAL_REMADOR: ProvaConfig = {
  id: 'abdominal_remador',
  label: 'Abdominal remador',
  icon: Activity,
  colors: ['#2a3320', '#556B2F'],
};
const ABDOMINAL_PRANCHA: ProvaConfig = {
  id: 'abdominal_prancha',
  label: 'Abdominal prancha',
  icon: Shield,
  colors: ['#3d4a28', '#6b5842'],
};

const PROVA_ROWS_PADRAO: ProvaConfig[][] = [
  [CORRIDA, NATACAO],
  [PERMANENCIA, CAMINHADA],
];

const PROVA_ROWS_NAVAL: ProvaConfig[][] = [
  [CORRIDA_3200, NATACAO_100],
  [PERMANENCIA_NAVAL, FLEXAO_BARRA],
  [FLEXAO_SOLO, ABDOMINAL_REMADOR],
  [ABDOMINAL_PRANCHA],
];

type Props = {
  variant?: 'padrao' | 'naval';
  onSelect: (id: TipoProvaTAF) => void;
};

function ProvaTile({
  prova,
  onSelect,
  isNativeMobile,
  glass,
  ui,
  theme,
  fullWidth,
}: {
  prova: ProvaConfig;
  onSelect: (id: TipoProvaTAF) => void;
  isNativeMobile: boolean;
  glass: ReturnType<typeof getAplicarTafGlass>;
  ui: ReturnType<typeof getUiColors>;
  theme: ReturnType<typeof useTheme>['theme'];
  fullWidth?: boolean;
}) {
  const Icon = prova.icon !== 'corrida-runner' ? prova.icon : null;

  return (
    <TouchableOpacity
      accessibilityLabel={prova.label}
      activeOpacity={0.9}
      onPress={() => onSelect(prova.id)}
      style={[styles.tileWrap, fullWidth ? styles.tileWrapFull : null]}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: glass.bg,
            borderColor: glass.border,
            minHeight: isNativeMobile ? 100 : 108,
          },
          Platform.OS === 'web'
            ? ({ boxShadow: '0 8px 24px rgba(15,23,42,0.08)' } as object)
            : null,
        ]}
      >
        <LinearGradient
          colors={prova.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          {Icon ? (
            <Icon size={22} color="#fff" strokeWidth={2.3} />
          ) : (
            <CorridaRunnerIcon size={22} color="#fff" strokeWidth={2.3} />
          )}
        </LinearGradient>
        <Text style={[styles.label, { color: ui.text }]}>{prova.label}</Text>
        <View
          style={[
            styles.arrow,
            { backgroundColor: theme.isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.16)' },
          ]}
        >
          <Text style={[styles.arrowText, { color: theme.primary }]}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function AplicarTafProvaSelector({ variant = 'padrao', onSelect }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const { isNativeMobile } = useAplicarTafLayout();
  const rows = variant === 'naval' ? PROVA_ROWS_NAVAL : PROVA_ROWS_PADRAO;

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`prova-row-${rowIndex}`} style={styles.row}>
          {row.map((prova) => (
            <ProvaTile
              key={prova.id}
              prova={prova}
              onSelect={onSelect}
              isNativeMobile={isNativeMobile}
              glass={glass}
              ui={ui}
              theme={theme}
              fullWidth={row.length === 1}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tileWrap: {
    flex: 1,
    minWidth: 0,
  },
  tileWrapFull: {
    flex: 1,
    maxWidth: '100%',
  },
  tile: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    minHeight: 108,
    gap: 10,
    position: 'relative',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  arrow: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
