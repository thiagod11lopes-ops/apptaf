import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import { AppModal } from '../premium/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Flag } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafBackdrop, getAplicarTafGlass } from './aplicar/aplicarTafTheme';
import { useAplicarTafLayout } from './aplicar/useAplicarTafLayout';
import { ConfirmacaoDesistenciaModal } from './aplicar/ConfirmacaoDesistenciaModal';
import { ConfirmacaoVoltarIdentificacaoModal } from './aplicar/ConfirmacaoVoltarIdentificacaoModal';
import { ParticipantesEscalaScrollBar } from './aplicar/ParticipantesEscalaScrollBar';
import { TafCronometroPanel, type TafCronometroEstado } from './TafCronometroPanel';

/** Escala dos cards dos militares (barra horizontal na prova ativa). */
const PARTICIPANTES_ESCALA_MIN = 0.7;
const PARTICIPANTES_ESCALA_MAX = 1.35;
/** Abre em 102% (ajustável). norm = (1.02 − min) / (max − min). */
const PARTICIPANTES_ESCALA_DEFAULT = (1.02 - PARTICIPANTES_ESCALA_MIN) / (PARTICIPANTES_ESCALA_MAX - PARTICIPANTES_ESCALA_MIN);

/** Estimativa da largura do nome (bold ~11px) para encaixar checklists o mais à esquerda. */
function estimarLarguraNomePx(nome: string, fontSize: number): number {
  const texto = (nome || '—').trim() || '—';
  let w = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i]!;
    if (ch === ' ') w += fontSize * 0.28;
    else if (/[iIl1.|']/.test(ch)) w += fontSize * 0.38;
    else if (/[mwMW@]/.test(ch)) w += fontSize * 0.78;
    else w += fontSize * 0.58;
  }
  return Math.ceil(w + 2);
}
import { TafVoltasPromptOverlay } from './TafVoltasPromptOverlay';
import { LogombWatermark } from '../mobile/LogombWatermark';
import type { ResultadoPermanenciaOpcao } from '../PermanenciaTafPanel';

export type TafProvaTempoModalProva = 'corrida' | 'caminhada' | 'natacao' | 'permanencia';

type MetaFieldScale = 'normal' | 'compact' | 'minimal';

/** Escala Tempo/Nota conforme comprimento do nome e colunas de volta (corrida/caminhada). */
function resolveMetaScaleForNome(
  nome: string,
  mostrarTempo: boolean,
  mostrarNota: boolean,
  nColunasVoltas: number,
): MetaFieldScale {
  const len = nome.trim().length;
  const dualMeta = mostrarTempo && mostrarNota;
  const voltasPressure = nColunasVoltas >= 10 ? 8 : nColunasVoltas >= 6 ? 5 : nColunasVoltas >= 3 ? 2 : 0;
  const effectiveLen = len + voltasPressure;

  if (effectiveLen >= 26 || (dualMeta && effectiveLen >= 16)) return 'minimal';
  if (effectiveLen >= 16 || (dualMeta && effectiveLen >= 10)) return 'compact';
  if (len >= 10 || dualMeta) return 'compact';
  return 'normal';
}

/** Largura do chip Tempo/Nota conforme o texto exibido (sem reticências). */
function resolveMetaFieldWidth(value: string, scale: MetaFieldScale): number {
  const text = value.trim() || '—';
  const charW = scale === 'minimal' ? 6.8 : scale === 'compact' ? 8.2 : 11.5;
  const pad = scale === 'minimal' ? 14 : scale === 'compact' ? 18 : 30;
  const floor = scale === 'minimal' ? 36 : scale === 'compact' ? 46 : 88;
  return Math.max(floor, Math.ceil(text.length * charW + pad));
}

/** Fonte única Tempo/Nota por escala — mesmos números, independente do comprimento. */
function resolveMetaValueFontSize(_value: string, scale: MetaFieldScale): number {
  return scale === 'minimal' ? 10 : scale === 'compact' ? 12 : 20;
}

export type TafProvaTempoModalProps = {
  visible: boolean;
  onClose: () => void;
  prova: TafProvaTempoModalProva;
  tituloProva: string;
  labelAtleta: string;
  tempoExibido: string;
  cronometroEstado: TafCronometroEstado;
  cronometroPausadoTexto: string;
  onCronometroPausadoTextoChange: (text: string) => void;
  onBlurCronometroPausado: () => void;
  onIniciarCronometro: () => void;
  onPararCronometro: () => void;
  onPausarCronometro: () => void;
  onContinuarCronometro: () => void;
  cronometroHint?: string;
  numeroVoltas?: string;
  onChangeNumeroVoltas?: (text: string) => void;
  /** Chamado após confirmar o número de voltas (corrida/caminhada). */
  onVoltasConfirmadas?: () => void;
  /** Restauração de sessão: já havia confirmado o número de voltas. */
  voltasJaConfirmadas?: boolean;
  nColunasVoltas?: number;
  nParticipantes: number;
  nomesParticipantes: string[];
  /** Índices (ou flags por participante) com fator de risco marcado. */
  participantesComFatorRisco?: boolean[];
  onPressNomeParticipante?: (index: number) => void;
  checksVoltas?: boolean[][];
  chegadaNatacao?: boolean[];
  onToggleVolta?: (participante: number, volta: number) => void;
  onToggleChegada?: (participante: number) => void;
  /** Corrida/natação: desistência por participante. */
  desistenciaParticipantes?: boolean[];
  onConfirmDesistencia?: (participante: number) => void;
  onClearDesistencia?: (participante: number) => void;
  nipsParticipantes?: string[];
  temposMilitaresMs?: (number | null)[];
  formatMs: (ms: number) => string;
  mostrarTempo: boolean;
  mostrarNota: boolean;
  getNota?: (index: number) => string;
  isNotaReprovado?: (index: number) => boolean;
  resultadosPermanencia?: ResultadoPermanenciaOpcao[];
  onTogglePermanencia?: (index: number, opcao: 'aprovado' | 'reprovado') => void;
  podeAplicar: boolean;
  onAplicar: () => void;
  salvando: boolean;
  erroAplicar?: string;
};

function MetaResultadoField({
  label,
  value,
  tone,
  theme,
  ui,
  scale = 'normal',
  adaptive = false,
}: {
  label: string;
  value: string;
  tone: 'tempo' | 'nota' | 'notaReprov';
  theme: ReturnType<typeof useTheme>['theme'];
  ui: ReturnType<typeof getUiColors>;
  scale?: MetaFieldScale;
  adaptive?: boolean;
}) {
  const valueColor =
    tone === 'notaReprov' ? theme.loss : tone === 'nota' ? theme.gain : ui.text;

  const gradientColors =
    tone === 'notaReprov'
      ? theme.isDark
        ? (['rgba(239,68,68,0.18)', 'rgba(127,29,29,0.12)'] as const)
        : (['rgba(254,226,226,0.95)', 'rgba(255,255,255,0.92)'] as const)
      : tone === 'nota'
        ? theme.isDark
          ? (['rgba(34,197,94,0.16)', 'rgba(15,23,42,0.5)'] as const)
          : (['rgba(220,252,231,0.95)', 'rgba(255,255,255,0.92)'] as const)
        : theme.isDark
          ? (['rgba(56,189,248,0.14)', 'rgba(99,102,241,0.1)'] as const)
          : (['rgba(224,242,254,0.95)', 'rgba(255,255,255,0.92)'] as const);

  const borderColor =
    tone === 'notaReprov'
      ? theme.isDark
        ? 'rgba(239,68,68,0.45)'
        : 'rgba(220,38,38,0.28)'
      : tone === 'nota'
        ? theme.isDark
          ? 'rgba(34,197,94,0.4)'
          : 'rgba(22,163,74,0.25)'
        : theme.isDark
          ? 'rgba(56,189,248,0.35)'
          : 'rgba(37,99,235,0.22)';

  const isCompact = scale === 'compact' || scale === 'minimal';
  const isMinimal = scale === 'minimal';
  const fieldWidth = adaptive ? resolveMetaFieldWidth(value, scale) : undefined;
  const valueFontSize = adaptive ? resolveMetaValueFontSize(value, scale) : undefined;

  return (
    <View
      style={[
        styles.metaField,
        isCompact ? styles.metaFieldCompact : null,
        isMinimal ? styles.metaFieldMinimal : null,
        adaptive ? styles.metaFieldAdaptive : null,
        adaptive && fieldWidth != null
          ? { width: fieldWidth, minWidth: fieldWidth, maxWidth: fieldWidth }
          : null,
        { borderColor },
      ]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFill} />
      <Text
        style={[
          styles.metaLabel,
          isCompact ? styles.metaLabelCompact : null,
          isMinimal ? styles.metaLabelMinimal : null,
          { color: theme.textMuted },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metaValue,
          isCompact ? styles.metaValueCompact : null,
          isMinimal ? styles.metaValueMinimal : null,
          valueFontSize != null ? { fontSize: valueFontSize, lineHeight: valueFontSize + 2 } : null,
          { color: valueColor },
          tone === 'notaReprov' ? styles.metaValueReprov : null,
          tone === 'notaReprov' && isCompact ? styles.metaValueReprovCompact : null,
          tone === 'notaReprov' && isMinimal ? styles.metaValueReprovMinimal : null,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit={false}
      >
        {value}
      </Text>
    </View>
  );
}

function CheckVolta({
  checked,
  onPress,
  a11y,
  touchLarge,
}: {
  checked: boolean;
  onPress: () => void;
  a11y: string;
  touchLarge?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={a11y}
      activeOpacity={0.85}
      onPress={onPress}
      hitSlop={touchLarge ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      style={[styles.checkOuter, touchLarge ? styles.checkOuterLarge : null]}
    >
      <View style={[styles.checkBox, checked ? styles.checkBoxOn : styles.checkBoxOff]}>
        {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
    </TouchableOpacity>
  );
}

function CheckPermanenciaModal({
  label,
  checked,
  onPress,
  variant,
  touchLarge,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  variant: 'aprovado' | 'reprovado';
  touchLarge?: boolean;
}) {
  const { theme } = useTheme();
  const onStyle = variant === 'aprovado' ? styles.checkPermOnAprov : styles.checkPermOnReprov;
  const labelColor = variant === 'aprovado' ? '#15803D' : theme.loss;

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      hitSlop={touchLarge ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      style={[styles.checkPermRow, touchLarge ? styles.checkOuterLarge : null]}
    >
      <View style={[styles.checkPermBox, checked ? onStyle : styles.checkPermOff]}>
        {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.checkPermLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Ícone de desistência (bandeira) — clicável, sem texto. */
function IconDesistencia({
  checked,
  onPress,
  touchLarge,
}: {
  checked: boolean;
  onPress: () => void;
  touchLarge?: boolean;
}) {
  const { theme } = useTheme();
  const size = touchLarge ? 28 : 26;
  const iconSize = touchLarge ? 15 : 14;

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={checked ? 'Desistência marcada' : 'Marcar desistência'}
      activeOpacity={0.85}
      onPress={onPress}
      hitSlop={touchLarge ? { top: 8, bottom: 8, left: 8, right: 8 } : { top: 6, bottom: 6, left: 6, right: 6 }}
      style={[
        styles.desistenciaIconBtn,
        {
          width: size,
          height: size,
          borderColor: checked ? theme.loss : theme.border,
          backgroundColor: checked
            ? theme.isDark
              ? 'rgba(220, 38, 38, 0.28)'
              : 'rgba(254, 226, 226, 0.98)'
            : theme.isDark
              ? 'rgba(15, 23, 42, 0.45)'
              : 'rgba(255, 255, 255, 0.95)',
        },
      ]}
    >
      <Flag
        size={iconSize}
        color={checked ? theme.loss : theme.textSecondary}
        strokeWidth={checked ? 2.8 : 2.4}
      />
    </TouchableOpacity>
  );
}

export function TafProvaTempoModal({
  visible,
  onClose,
  prova,
  tituloProva,
  labelAtleta,
  tempoExibido,
  cronometroEstado,
  cronometroPausadoTexto,
  onCronometroPausadoTextoChange,
  onBlurCronometroPausado,
  onIniciarCronometro,
  onPararCronometro,
  onPausarCronometro,
  onContinuarCronometro,
  cronometroHint,
  numeroVoltas = '',
  onChangeNumeroVoltas,
  onVoltasConfirmadas,
  voltasJaConfirmadas = false,
  nColunasVoltas = 0,
  nParticipantes,
  nomesParticipantes,
  participantesComFatorRisco = [],
  onPressNomeParticipante,
  checksVoltas = [],
  chegadaNatacao = [],
  onToggleVolta,
  onToggleChegada,
  desistenciaParticipantes = [],
  onConfirmDesistencia,
  onClearDesistencia,
  nipsParticipantes = [],
  temposMilitaresMs = [],
  formatMs,
  mostrarTempo,
  mostrarNota,
  getNota,
  isNotaReprovado,
  resultadosPermanencia = [],
  onTogglePermanencia,
  podeAplicar,
  onAplicar,
  salvando,
  erroAplicar,
}: TafProvaTempoModalProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const ts = theme.textStyles;
  const { isNativeMobile, modalBottomPad, horizontalPad } = useAplicarTafLayout();

  const glass = getAplicarTafGlass(theme);
  const permiteDesistencia =
    (prova === 'corrida' || prova === 'natacao') &&
    onConfirmDesistencia != null &&
    onClearDesistencia != null;

  const [voltasConfirmadas, setVoltasConfirmadas] = useState(false);
  const [modalLayout, setModalLayout] = useState({ width: 0, height: 0 });
  const [desistenciaPendente, setDesistenciaPendente] = useState<number | null>(null);
  const [confirmarVoltarIdentificacao, setConfirmarVoltarIdentificacao] = useState(false);
  const [escalaParticipantesNorm, setEscalaParticipantesNorm] = useState(
    PARTICIPANTES_ESCALA_DEFAULT,
  );
  const [participantesBaseHeight, setParticipantesBaseHeight] = useState(0);

  const onModalLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setModalLayout({ width, height });
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setVoltasConfirmadas(false);
      setDesistenciaPendente(null);
      setConfirmarVoltarIdentificacao(false);
      setEscalaParticipantesNorm(PARTICIPANTES_ESCALA_DEFAULT);
      setParticipantesBaseHeight(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (voltasJaConfirmadas && nColunasVoltas >= 1) {
      setVoltasConfirmadas(true);
    }
  }, [visible, voltasJaConfirmadas, nColunasVoltas]);

  const escalaParticipantes = useMemo(
    () =>
      PARTICIPANTES_ESCALA_MIN +
      escalaParticipantesNorm * (PARTICIPANTES_ESCALA_MAX - PARTICIPANTES_ESCALA_MIN),
    [escalaParticipantesNorm],
  );

  useEffect(() => {
    if (!numeroVoltas) setVoltasConfirmadas(false);
  }, [numeroVoltas]);

  const onPressDesistencia = useCallback(
    (index: number) => {
      if (!permiteDesistencia) return;
      if (desistenciaParticipantes[index]) {
        onClearDesistencia?.(index);
        return;
      }
      setDesistenciaPendente(index);
    },
    [permiteDesistencia, desistenciaParticipantes, onClearDesistencia],
  );

  const cronometroParado =
    cronometroEstado === 'inicial' || cronometroEstado === 'finalizado';

  const voltasValidas = nColunasVoltas >= 1;

  const mostrarPromptVoltas =
    (prova === 'corrida' || prova === 'caminhada') &&
    onChangeNumeroVoltas != null &&
    cronometroParado &&
    !voltasConfirmadas;

  const nColunasVoltasAtivas = voltasConfirmadas ? nColunasVoltas : 0;

  const confirmarVoltas = () => {
    if (!voltasValidas) return;
    setVoltasConfirmadas(true);
    onVoltasConfirmadas?.();
  };

  const onParticipantesBaseLayout = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0) setParticipantesBaseHeight(h);
  }, []);

  /**
   * Largura da coluna nome (+ bandeira) = maior nome da lista (com teto).
   * Assim os checklists começam juntos, o mais à esquerda possível, sem cobrir nomes.
   */
  const identityColWidth = useMemo(() => {
    const fontSize = isNativeMobile ? 10 : 11;
    const iconW = permiteDesistencia ? (isNativeMobile ? 28 : 26) : 0;
    const gapIcon = permiteDesistencia ? 8 : 0;
    const padDireita = 6;
    let maxNome = estimarLarguraNomePx('—', fontSize);
    for (let i = 0; i < nParticipantes; i += 1) {
      maxNome = Math.max(
        maxNome,
        estimarLarguraNomePx(nomesParticipantes[i] ?? '—', fontSize),
      );
    }
    const natural = iconW + gapIcon + maxNome + padDireita;
    const minW = iconW + gapIcon + 40;
    const maxW = isNativeMobile ? 150 : 220;
    return Math.min(maxW, Math.max(minW, natural));
  }, [
    nParticipantes,
    nomesParticipantes,
    permiteDesistencia,
    isNativeMobile,
  ]);

  const participantesList = (
    <View
      onLayout={onParticipantesBaseLayout}
      style={[
        styles.participantesStack,
        styles.participantesScaledWrap,
        {
          transform: [{ scale: escalaParticipantes }],
          width: `${100 / escalaParticipantes}%`,
        },
        Platform.OS === 'web'
          ? ({ transformOrigin: 'top left' } as object)
          : { alignSelf: 'flex-start' as const },
      ]}
    >
      {Array.from({ length: nParticipantes }, (_, index) => {
        const nome = nomesParticipantes[index] ?? '—';
        const temFatorRisco = participantesComFatorRisco[index] === true;
        const desistiu = permiteDesistencia && (desistenciaParticipantes[index] ?? false);
        const tempoMs = temposMilitaresMs[index];
        const tempoStr = desistiu ? '—' : tempoMs != null ? formatMs(tempoMs) : '—';
        const nota = desistiu ? 'REPROVADO' : (getNota?.(index) ?? '—');
        const notaReprov = desistiu || (isNotaReprovado?.(index) ?? false);

        const temChecks =
          (prova === 'permanencia' && onTogglePermanencia != null) ||
          (prova === 'natacao' && onToggleChegada != null && !desistiu) ||
          ((prova === 'corrida' || prova === 'caminhada') &&
            nColunasVoltasAtivas > 0 &&
            onToggleVolta != null &&
            !desistiu);

        const isCorridaCaminhada = prova === 'corrida' || prova === 'caminhada';
        const isNatacao = prova === 'natacao';
        const isPermanencia = prova === 'permanencia';
        /** Corrida, caminhada e natação compartilham o mesmo layout de card preparado. */
        const isProvaLayoutPreparado = isCorridaCaminhada || isNatacao;
        const colunasChecksLayout = isCorridaCaminhada
          ? nColunasVoltasAtivas
          : isNatacao && temChecks
            ? 1
            : 0;
        const metaScale: MetaFieldScale =
          isProvaLayoutPreparado && (mostrarTempo || mostrarNota)
            ? resolveMetaScaleForNome(
                nome,
                mostrarTempo,
                mostrarNota,
                colunasChecksLayout,
              )
            : isNativeMobile
              ? 'compact'
              : 'normal';

        return (
          <View
            key={`prov-modal-${index}`}
            style={[
              styles.participantCard,
              {
                borderColor: desistiu ? theme.loss : glass.border,
                backgroundColor: glass.bg,
              },
            ]}
          >
            <View
              style={[
                styles.numBadgeSide,
                {
                  backgroundColor: desistiu
                    ? theme.isDark
                      ? 'rgba(220,38,38,0.25)'
                      : 'rgba(254,226,226,0.95)'
                    : theme.isDark
                      ? 'rgba(34,197,94,0.2)'
                      : PREMIUM.accentMuted,
                },
              ]}
              accessibilityLabel={`Participante ${index + 1}`}
            >
              <Text
                style={[
                  styles.numBadgeSideText,
                  { color: desistiu ? theme.loss : theme.success },
                ]}
              >
                {index + 1}
              </Text>
            </View>

            <View style={styles.participantCardBody}>
              <View
                style={[
                  styles.participantTopRow,
                  isProvaLayoutPreparado || isPermanencia ? styles.participantTopRowAdaptive : null,
                ]}
              >
                <View
                  style={[
                    styles.identityCol,
                    styles.identityColFixed,
                    {
                      width: identityColWidth,
                      maxWidth: identityColWidth,
                    },
                    permiteDesistencia ? styles.identityColWithDesistencia : null,
                  ]}
                >
                  {permiteDesistencia ? (
                    <IconDesistencia
                      checked={desistiu}
                      touchLarge={isNativeMobile}
                      onPress={() => onPressDesistencia(index)}
                    />
                  ) : null}
                  <Text
                    accessibilityRole={temFatorRisco ? 'button' : undefined}
                    onPress={
                      temFatorRisco && onPressNomeParticipante
                        ? () => onPressNomeParticipante(index)
                        : undefined
                    }
                    style={[
                      styles.participantNome,
                      styles.participantNomeAdaptive,
                      isNativeMobile ? styles.participantNomeCompact : null,
                      {
                        color: desistiu ? theme.loss : temFatorRisco ? '#ea580c' : ui.text,
                        textDecorationLine: temFatorRisco ? 'underline' : 'none',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {nome}
                  </Text>
                </View>

                <View
                  style={[
                    styles.checksColAligned,
                    isPermanencia ? styles.checksColPermanencia : null,
                  ]}
                >
                  {temChecks ? (
                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={isNativeMobile}
                      style={styles.checksRowInline}
                      contentContainerStyle={[
                        styles.checksTrackContent,
                        isPermanencia ? styles.checksTrackPermanencia : null,
                      ]}
                      keyboardShouldPersistTaps="handled"
                    >
                      {prova === 'permanencia' && onTogglePermanencia ? (
                        <>
                          <CheckPermanenciaModal
                            label="Aprovado"
                            checked={resultadosPermanencia[index] === 'aprovado'}
                            variant="aprovado"
                            touchLarge={isNativeMobile}
                            onPress={() => onTogglePermanencia(index, 'aprovado')}
                          />
                          <CheckPermanenciaModal
                            label="Reprovado"
                            checked={resultadosPermanencia[index] === 'reprovado'}
                            variant="reprovado"
                            touchLarge={isNativeMobile}
                            onPress={() => onTogglePermanencia(index, 'reprovado')}
                          />
                        </>
                      ) : null}

                      {prova === 'natacao' && onToggleChegada && !desistiu ? (
                        <CheckVolta
                          checked={chegadaNatacao[index] ?? false}
                          a11y={`Marcar chegada, ${labelAtleta} ${index + 1}`}
                          touchLarge={isNativeMobile}
                          onPress={() => onToggleChegada(index)}
                        />
                      ) : null}

                      {(prova === 'corrida' || prova === 'caminhada') &&
                      nColunasVoltasAtivas > 0 &&
                      onToggleVolta &&
                      !desistiu
                        ? Array.from({ length: nColunasVoltasAtivas }, (__, v) => (
                            <CheckVolta
                              key={`volta-${index}-${v}`}
                              checked={checksVoltas[index]?.[v] ?? false}
                              a11y={`Volta ${v + 1}, participante ${index + 1}`}
                              touchLarge={isNativeMobile}
                              onPress={() => onToggleVolta(index, v)}
                            />
                          ))
                        : null}
                    </ScrollView>
                  ) : null}
                </View>

                {mostrarTempo || mostrarNota ? (
                  <View
                    style={[
                      styles.metaStrip,
                      isProvaLayoutPreparado ? styles.metaStripAdaptive : null,
                    ]}
                  >
                    {mostrarTempo ? (
                      <MetaResultadoField
                        label="Tempo"
                        value={tempoStr}
                        tone="tempo"
                        theme={theme}
                        ui={ui}
                        scale={metaScale}
                        adaptive={isProvaLayoutPreparado}
                      />
                    ) : null}
                    {mostrarNota ? (
                      <MetaResultadoField
                        label="Nota"
                        value={nota}
                        tone={notaReprov ? 'notaReprov' : 'nota'}
                        theme={theme}
                        ui={ui}
                        scale={metaScale}
                        adaptive={isProvaLayoutPreparado}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
    <AppModal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => setConfirmarVoltarIdentificacao(true)}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot} onLayout={onModalLayout}>
        <LinearGradient
          colors={[...getAplicarTafBackdrop(theme)]}
          locations={[0, 0.4, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        {modalLayout.width > 0 && modalLayout.height > 0 ? (
          <View style={styles.modalLogoLayer} pointerEvents="none">
            <LogombWatermark
              containerWidth={modalLayout.width}
              containerHeight={modalLayout.height}
              sizeMultiplier={2}
            />
          </View>
        ) : null}
        <View style={styles.modalForeground}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPad },
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <View
            style={[
              styles.participantesScaleSlot,
              participantesBaseHeight > 0
                ? { height: participantesBaseHeight * escalaParticipantes }
                : null,
            ]}
          >
            {participantesList}
          </View>
          {erroAplicar ? (
            <Text style={[styles.erroText, { color: theme.loss }]}>{erroAplicar}</Text>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: glass.border,
              backgroundColor: glass.bg,
              paddingBottom: modalBottomPad,
              paddingHorizontal: horizontalPad,
            },
          ]}
        >
          {nParticipantes > 0 ? (
            <ParticipantesEscalaScrollBar
              value={escalaParticipantesNorm}
              onChange={setEscalaParticipantesNorm}
              scaleLabel={escalaParticipantes}
            />
          ) : null}
          {podeAplicar ? (
            <TouchableOpacity
              accessibilityLabel={`Aplicar resultado da ${tituloProva.toLowerCase()}`}
              activeOpacity={0.9}
              onPress={onAplicar}
              disabled={salvando}
              style={[styles.btnAplicarWrap, salvando ? styles.btnDisabled : null]}
            >
              <LinearGradient
                colors={[theme.primary, '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnAplicar}
              >
                {salvando ? (
                  <ActivityIndicator color={theme.tokens.textOnPrimary} />
                ) : (
                  <Text style={[ts.body, styles.btnAplicarText, { color: theme.tokens.textOnPrimary }]}>
                    Aplicar Resultado
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TafCronometroPanel
              variant="compact"
              tituloProva={tituloProva}
              tempoExibido={tempoExibido}
              estado={cronometroEstado}
              pausadoTexto={cronometroPausadoTexto}
              onPausadoTextoChange={onCronometroPausadoTextoChange}
              onBlurPausado={onBlurCronometroPausado}
              onIniciar={onIniciarCronometro}
              onParar={onPararCronometro}
              onPausar={onPausarCronometro}
              onContinuar={onContinuarCronometro}
              hint={cronometroHint}
              onVoltarIdentificacao={() => setConfirmarVoltarIdentificacao(true)}
            />
          )}
        </View>

        {mostrarPromptVoltas && onChangeNumeroVoltas ? (
          <TafVoltasPromptOverlay
            visible={mostrarPromptVoltas}
            prova={prova}
            tituloProva={tituloProva}
            numeroVoltas={numeroVoltas}
            onChangeNumeroVoltas={onChangeNumeroVoltas}
            onConfirm={confirmarVoltas}
            confirmEnabled={voltasValidas}
          />
        ) : null}
      </SafeAreaView>
        </View>
      </View>
    </AppModal>
    <ConfirmacaoDesistenciaModal
      visible={desistenciaPendente != null}
      nip={desistenciaPendente != null ? (nipsParticipantes[desistenciaPendente] ?? '') : ''}
      nome={desistenciaPendente != null ? (nomesParticipantes[desistenciaPendente] ?? '') : ''}
      provaLabel={tituloProva}
      onClose={() => setDesistenciaPendente(null)}
      onConfirm={() => {
        if (desistenciaPendente == null) return;
        onConfirmDesistencia?.(desistenciaPendente);
        setDesistenciaPendente(null);
      }}
    />
    <ConfirmacaoVoltarIdentificacaoModal
      visible={confirmarVoltarIdentificacao}
      provaLabel={tituloProva}
      onClose={() => setConfirmarVoltarIdentificacao(false)}
      onConfirm={() => {
        setConfirmarVoltarIdentificacao(false);
        onClose();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    position: 'relative',
  },
  modalLogoLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  modalForeground: {
    flex: 1,
    zIndex: 2,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 3,
  },
  participantesScaleSlot: {
    width: '100%',
    overflow: 'visible',
  },
  participantesScaledWrap: {
    alignSelf: 'flex-start',
  },
  participantesStack: {
    gap: 3,
    width: '100%',
    flexDirection: 'column',
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 10, default: 12 }),
    borderTopWidth: 1,
    gap: 8,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingLeft: 0,
    paddingRight: 0,
    paddingVertical: 0,
    marginBottom: 2,
    overflow: 'hidden',
    gap: 0,
  },
  participantCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 6,
    justifyContent: 'center',
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    minHeight: 0,
    width: '100%',
  },
  participantTopRowAdaptive: {
    alignItems: 'center',
  },
  identityCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flexShrink: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  /** Largura calculada pelo maior nome — checklists alinhados e o mais à esquerda. */
  identityColFixed: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  identityColWithDesistencia: {
    gap: 8,
    alignItems: 'center',
  },
  participantNomeAdaptive: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 'auto',
    lineHeight: 13,
    minWidth: 0,
  },
  rowDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.55,
    marginVertical: 2,
    flexShrink: 0,
  },
  checksColAligned: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    marginRight: 'auto',
  },
  checksColPermanencia: {
    flexGrow: 0,
  },
  checksRowInline: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  checkOuterLarge: {
    padding: 2,
  },
  checksTrackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexGrow: 0,
  },
  checksTrackPermanencia: {
    gap: 18,
    paddingVertical: 0,
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexShrink: 0,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
  metaStripAdaptive: {
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 0,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
  numBadgeSide: {
    width: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: PREMIUM.radiusMd - 1,
    borderBottomLeftRadius: PREMIUM.radiusMd - 1,
    flexShrink: 0,
  },
  numBadgeSideText: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numBadgeCompact: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  numBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  numBadgeTextCompact: {
    fontSize: 9,
  },
  participantNome: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  participantNomeCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  metaField: {
    minWidth: 104,
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(15,23,42,0.08)' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  metaFieldCompact: {
    minWidth: 48,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 4,
    gap: 0,
  },
  metaFieldMinimal: {
    minWidth: 34,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 3,
    gap: 0,
  },
  metaFieldAdaptive: {
    flexShrink: 0,
    overflow: 'visible',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metaLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.8,
  },
  metaLabelMinimal: {
    fontSize: 7,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 0.4,
  },
  metaValueCompact: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  metaValueMinimal: {
    fontSize: 10,
    letterSpacing: 0,
  },
  metaValueReprov: {
    fontSize: 18,
  },
  metaValueReprovCompact: {
    fontSize: 11,
  },
  metaValueReprovMinimal: {
    fontSize: 9,
  },
  checkOuter: {
    padding: 2,
  },
  checkBox: {
    width: Platform.OS === 'web' ? 32 : 28,
    height: Platform.OS === 'web' ? 32 : 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOff: {
    borderColor: 'rgba(100, 116, 139, 0.35)',
    backgroundColor: 'transparent',
  },
  checkBoxOn: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  checkPermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 4,
  },
  checkPermLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  checkPermBox: {
    width: Platform.OS === 'web' ? 32 : 28,
    height: Platform.OS === 'web' ? 32 : 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPermOff: {
    borderColor: 'rgba(100, 116, 139, 0.35)',
    backgroundColor: 'transparent',
  },
  checkPermOnAprov: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  checkPermOnReprov: {
    borderColor: '#B91C1C',
    backgroundColor: '#B91C1C',
  },
  desistenciaIconBtn: {
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnAplicarWrap: {
    width: '100%',
    borderRadius: PREMIUM.radiusMd + 2,
    overflow: 'hidden',
  },
  btnAplicar: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAplicarText: {
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.72,
  },
  erroText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
