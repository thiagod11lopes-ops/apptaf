import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { PenLine } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RubricaCell } from './RubricaThumb';
import { temRubricaPresente } from '../utils/rubricaPresence';

type Props = {
  titulo: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  rubricaSvg?: string | null;
  /** Tarja vermelha para corrida/caminhada substituída ou não aplicada (TAF Armada). */
  dispensavel?: boolean;
  /** Clique na rúbrica: editar se existir, ou adicionar se estiver vazia. */
  onPressRubrica?: () => void;
  /** @deprecated Use onPressRubrica */
  onDuploCliqueRubrica?: () => void;
};

/** Bloco de prova com coluna dedicada "Rúbrica" ao lado dos dados. */
export function ProvaComColunaRubrica({
  titulo,
  headerRight,
  children,
  rubricaSvg,
  dispensavel = false,
  onPressRubrica,
  onDuploCliqueRubrica,
}: Props) {
  const { theme, isDark } = useTheme();
  const onRubrica = onPressRubrica ?? onDuploCliqueRubrica;
  const temRubrica = temRubricaPresente(rubricaSvg);

  const handlePress = useCallback(() => {
    onRubrica?.();
  }, [onRubrica]);

  const rubricaArea = temRubrica ? (
    <View style={styles.rubricaHit} pointerEvents="box-none">
      <RubricaCell svgUri={rubricaSvg} somenteTexto />
      {onRubrica ? (
        <Text style={[styles.rubricaHint, { color: theme.textMuted }]} pointerEvents="none">
          Toque para alterar
        </Text>
      ) : null}
    </View>
  ) : (
    <View
      style={[
        styles.rubricaHit,
        styles.rubricaVazia,
        {
          borderColor: theme.border,
          backgroundColor: isDark ? 'rgba(2,6,23,0.35)' : 'rgba(248,250,252,0.95)',
        },
      ]}
      pointerEvents="box-none"
    >
      {onRubrica ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.addIconWrap,
              {
                backgroundColor: isDark ? 'rgba(37,99,235,0.22)' : 'rgba(37,99,235,0.1)',
                borderColor: theme.primary,
              },
            ]}
          >
            <PenLine size={22} color={theme.primary} strokeWidth={2.4} />
          </View>
          <Text style={[styles.addLabel, { color: theme.primary }]} pointerEvents="none">
            Adicionar rúbrica
          </Text>
        </>
      ) : (
        <Text style={[styles.rubricaHint, { color: theme.textMuted }]} pointerEvents="none">
          Sem rúbrica
        </Text>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.block,
        { borderTopColor: theme.borderSubtle },
        dispensavel && {
          borderColor: theme.loss,
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingBottom: 10,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.header} pointerEvents="box-none">
        <Text
          style={[
            styles.titulo,
            { color: dispensavel ? theme.loss : theme.textSecondary },
          ]}
          pointerEvents="none"
        >
          {titulo}
        </Text>
        {headerRight}
      </View>
      <View style={[styles.grid, dispensavel && styles.gridFaded]} pointerEvents="box-none">
        <View style={styles.dadosCol}>{children}</View>
        <View style={styles.rubricaCol} pointerEvents="box-none">
          <Text style={[styles.rubricaLabel, { color: theme.textMuted }]} pointerEvents="none">
            Rúbrica
          </Text>
          {onRubrica ? (
            <TouchableOpacity
              onPress={handlePress}
              activeOpacity={0.82}
              accessibilityLabel={temRubrica ? 'Alterar rúbrica' : 'Adicionar rúbrica'}
              accessibilityRole="button"
              style={[
                styles.pressWrap,
                Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
              ]}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: { preventDefault?: () => void; stopPropagation?: () => void }) => {
                      e?.preventDefault?.();
                      e?.stopPropagation?.();
                      handlePress();
                    },
                  } as object)
                : null)}
            >
              {rubricaArea}
            </TouchableOpacity>
          ) : (
            rubricaArea
          )}
        </View>
      </View>
      {dispensavel ? (
        <View style={styles.dispensavelOverlay} pointerEvents="none">
          <View style={[styles.dispensavelStripe, { backgroundColor: theme.loss }]}>
            <Text style={styles.dispensavelText}>Dispensável</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    zIndex: 2,
  },
  titulo: {
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    zIndex: 2,
  },
  gridFaded: {
    opacity: 0.32,
  },
  dadosCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rubricaCol: {
    width: '42%',
    maxWidth: 440,
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  rubricaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  pressWrap: {
    width: '100%',
    zIndex: 4,
  },
  rubricaHit: {
    width: '100%',
    minHeight: 72,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  rubricaVazia: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  addIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  rubricaHint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  dispensavelOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    zIndex: 1,
  },
  dispensavelStripe: {
    transform: [{ rotate: '-14deg' }],
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 4,
    minWidth: '88%',
    alignItems: 'center',
  },
  dispensavelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
