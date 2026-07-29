import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RubricaCell } from './RubricaThumb';

type Props = {
  titulo: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  rubricaSvg?: string | null;
  /** Tarja vermelha para corrida/caminhada substituída ou não aplicada (TAF Armada). */
  dispensavel?: boolean;
  /** Duplo clique / duplo toque na área da rúbrica (desenho ou espaço em branco). */
  onDuploCliqueRubrica?: () => void;
};

const DUPLO_MS = 320;

/** Bloco de prova com coluna dedicada "Rúbrica" ao lado dos dados. */
export function ProvaComColunaRubrica({
  titulo,
  headerRight,
  children,
  rubricaSvg,
  dispensavel = false,
  onDuploCliqueRubrica,
}: Props) {
  const { theme } = useTheme();
  const lastTapRef = useRef(0);

  const dispararDuplo = useCallback(() => {
    onDuploCliqueRubrica?.();
  }, [onDuploCliqueRubrica]);

  const onPressRubrica = useCallback(() => {
    if (!onDuploCliqueRubrica) return;
    if (Platform.OS === 'web') return;
    const now = Date.now();
    if (now - lastTapRef.current < DUPLO_MS) {
      lastTapRef.current = 0;
      dispararDuplo();
    } else {
      lastTapRef.current = now;
    }
  }, [onDuploCliqueRubrica, dispararDuplo]);

  const temRubrica = !!(rubricaSvg && String(rubricaSvg).trim());

  const rubricaArea = (
    <View
      style={[
        styles.rubricaHit,
        !temRubrica && onDuploCliqueRubrica
          ? {
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            }
          : null,
      ]}
    >
      <RubricaCell svgUri={rubricaSvg} />
      {!temRubrica && onDuploCliqueRubrica ? (
        <Text style={[styles.rubricaHint, { color: theme.textMuted }]}>
          Duplo clique para assinar
        </Text>
      ) : null}
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
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.titulo,
            { color: dispensavel ? theme.loss : theme.textSecondary },
          ]}
        >
          {titulo}
        </Text>
        {headerRight}
      </View>
      <View style={[styles.grid, dispensavel && styles.gridFaded]}>
        <View style={styles.dadosCol}>{children}</View>
        <View style={styles.rubricaCol}>
          <Text style={[styles.rubricaLabel, { color: theme.textMuted }]}>Rúbrica</Text>
          {onDuploCliqueRubrica ? (
            <Pressable
              onPress={onPressRubrica}
              accessibilityLabel={
                temRubrica
                  ? 'Duplo clique para substituir a rúbrica'
                  : 'Duplo clique para adicionar a rúbrica'
              }
              accessibilityHint="Toque duas vezes para abrir o campo de assinatura"
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: { detail?: number }) => {
                      if (e?.detail === 2) dispararDuplo();
                    },
                  } as object)
                : null)}
            >
              {rubricaArea}
            </Pressable>
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
  },
  rubricaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  rubricaHit: {
    width: '100%',
    minHeight: 56,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
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
