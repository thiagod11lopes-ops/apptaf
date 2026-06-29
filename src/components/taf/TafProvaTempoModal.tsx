import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafBackdrop, getAplicarTafGlass } from './aplicar/aplicarTafTheme';
import { useAplicarTafLayout } from './aplicar/useAplicarTafLayout';
import { TafCronometroPanel, type TafCronometroEstado } from './TafCronometroPanel';
import { TafVoltasPromptOverlay } from './TafVoltasPromptOverlay';
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

/** Fonte do valor conforme comprimento — reduz antes de truncar. */
function resolveMetaValueFontSize(value: string, scale: MetaFieldScale): number {
  const len = (value.trim() || '—').length;
  const base = scale === 'minimal' ? 10 : scale === 'compact' ? 12 : 20;
  const min = scale === 'minimal' ? 7 : scale === 'compact' ? 8 : 11;
  if (len <= 5) return base;
  if (len <= 7) return Math.max(min, base - 2);
  if (len <= 9) return Math.max(min, base - 3);
  return min;
}

function resolveMetaReprovFontSize(value: string, scale: MetaFieldScale, baseSize: number): number {
  const len = value.trim().length;
  if (len <= 6) return baseSize;
  return Math.max(scale === 'minimal' ? 7 : 8, baseSize - 1);
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
  nColunasVoltas?: number;
  nParticipantes: number;
  nomesParticipantes: string[];
  checksVoltas?: boolean[][];
  chegadaNatacao?: boolean[];
  onToggleVolta?: (participante: number, volta: number) => void;
  onToggleChegada?: (participante: number) => void;
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
  let valueFontSize = adaptive ? resolveMetaValueFontSize(value, scale) : undefined;
  if (valueFontSize != null && tone === 'notaReprov') {
    valueFontSize = resolveMetaReprovFontSize(value, scale, valueFontSize);
  }

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
          valueFontSize != null ? { fontSize: valueFontSize } : null,
          { color: valueColor },
          tone === 'notaReprov' ? styles.metaValueReprov : null,
          tone === 'notaReprov' && isCompact ? styles.metaValueReprovCompact : null,
          tone === 'notaReprov' && isMinimal ? styles.metaValueReprovMinimal : null,
          tone === 'notaReprov' && valueFontSize != null ? { fontSize: valueFontSize } : null,
        ]}
        numberOfLines={adaptive ? undefined : 1}
        adjustsFontSizeToFit={!adaptive && isCompact}
        minimumFontScale={0.35}
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
  const onStyle = variant === 'aprovado' ? styles.checkPermOnAprov : styles.checkPermOnReprov;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      hitSlop={touchLarge ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      style={[styles.checkPermOuter, touchLarge ? styles.checkOuterLarge : null]}
    >
      <View style={[styles.checkPermBox, checked ? onStyle : styles.checkPermOff]}>
        {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
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
  nColunasVoltas = 0,
  nParticipantes,
  nomesParticipantes,
  checksVoltas = [],
  chegadaNatacao = [],
  onToggleVolta,
  onToggleChegada,
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

  const tituloModal = `${tituloProva} preparada`;
  const glass = getAplicarTafGlass(theme);

  const [voltasConfirmadas, setVoltasConfirmadas] = useState(false);

  useEffect(() => {
    if (!visible) setVoltasConfirmadas(false);
  }, [visible]);

  useEffect(() => {
    if (!numeroVoltas) setVoltasConfirmadas(false);
  }, [numeroVoltas]);

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
    if (voltasValidas) setVoltasConfirmadas(true);
  };

  const participantesList = (
    <>
      {Array.from({ length: nParticipantes }, (_, index) => {
        const nome = nomesParticipantes[index] ?? '—';
        const tempoMs = temposMilitaresMs[index];
        const tempoStr = tempoMs != null ? formatMs(tempoMs) : '—';
        const nota = getNota?.(index) ?? '—';
        const notaReprov = isNotaReprovado?.(index) ?? false;

        const temChecks =
          (prova === 'permanencia' && onTogglePermanencia != null) ||
          (prova === 'natacao' && onToggleChegada != null) ||
          ((prova === 'corrida' || prova === 'caminhada') &&
            nColunasVoltasAtivas > 0 &&
            onToggleVolta != null);

        const isCorridaCaminhada = prova === 'corrida' || prova === 'caminhada';
        const metaScale: MetaFieldScale =
          isCorridaCaminhada && (mostrarTempo || mostrarNota)
            ? resolveMetaScaleForNome(
                nome,
                mostrarTempo,
                mostrarNota,
                nColunasVoltasAtivas,
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
                borderColor: glass.border,
                backgroundColor: glass.bg,
              },
            ]}
          >
            <View
              style={[
                styles.participantTopRow,
                isCorridaCaminhada ? styles.participantTopRowAdaptive : null,
              ]}
            >
              <View
                style={[
                  styles.identityCol,
                  isNativeMobile && !isCorridaCaminhada ? styles.identityColCompact : null,
                  isCorridaCaminhada ? styles.identityColAdaptive : null,
                  temChecks ? styles.identityColWithChecksBelow : null,
                ]}
              >
                <View
                  style={[
                    styles.numBadge,
                    isNativeMobile ? styles.numBadgeCompact : null,
                    { backgroundColor: theme.isDark ? 'rgba(34,197,94,0.2)' : PREMIUM.accentMuted },
                  ]}
                >
                  <Text
                    style={[
                      styles.numBadgeText,
                      isNativeMobile ? styles.numBadgeTextCompact : null,
                      { color: theme.success },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.participantNome,
                    isNativeMobile && !isCorridaCaminhada ? styles.participantNomeCompact : null,
                    isCorridaCaminhada ? styles.participantNomeAdaptive : null,
                    { color: ui.text },
                  ]}
                >
                  {nome}
                </Text>
              </View>

              {mostrarTempo || mostrarNota ? (
                <>
                  <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  <View
                    style={[
                      styles.metaStrip,
                      isCorridaCaminhada ? styles.metaStripAdaptive : null,
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
                        adaptive={isCorridaCaminhada}
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
                        adaptive={isCorridaCaminhada}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>

            {temChecks ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={isNativeMobile}
                style={styles.checksRowBelow}
                contentContainerStyle={styles.checksTrackContent}
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

                {prova === 'natacao' && onToggleChegada ? (
                  <CheckVolta
                    checked={chegadaNatacao[index] ?? false}
                    a11y={`Marcar chegada, ${labelAtleta} ${index + 1}`}
                    touchLarge={isNativeMobile}
                    onPress={() => onToggleChegada(index)}
                  />
                ) : null}

                {(prova === 'corrida' || prova === 'caminhada') &&
                nColunasVoltasAtivas > 0 &&
                onToggleVolta
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
        );
      })}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <LinearGradient
          colors={[...getAplicarTafBackdrop(theme)]}
          locations={[0, 0.4, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <View style={[styles.header, { borderBottomColor: glass.border }]}>
            <View style={styles.headerTextCol}>
              <Text style={[styles.headerKicker, { color: theme.primary }]}>PROVA ATIVA</Text>
              <Text style={[styles.headerTitle, { color: ui.text }]} numberOfLines={1}>
                {tituloModal}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar modal da prova"
              activeOpacity={0.88}
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: glass.border, backgroundColor: glass.highlight }]}
            >
              <X size={22} color={ui.iconStrong} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

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
          {participantesList}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 3,
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 10, default: 12 }),
    borderTopWidth: 1,
    gap: 8,
  },
  participantCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginBottom: 2,
    overflow: 'visible',
    gap: 6,
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
  },
  participantTopRowAdaptive: {
    alignItems: 'flex-start',
  },
  identityCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '34%',
  },
  identityColCompact: {
    maxWidth: '30%',
  },
  identityColAdaptive: {
    flex: 1,
    flexShrink: 0,
    minWidth: 0,
    maxWidth: undefined,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    paddingTop: 1,
  },
  identityColWithChecksBelow: {
    flex: 1,
    maxWidth: undefined,
  },
  participantNomeAdaptive: {
    flexShrink: 0,
    flexGrow: 1,
    flexBasis: 'auto',
    lineHeight: 14,
  },
  rowDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.55,
    marginVertical: 2,
    flexShrink: 0,
  },
  checksRowBelow: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  checkOuterLarge: {
    padding: 4,
  },
  checksTrackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  metaStripAdaptive: {
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 0,
    alignSelf: 'center',
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
    lineHeight: 14,
  },
  participantNomeCompact: {
    fontSize: 10,
    lineHeight: 13,
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
  checkPermOuter: {
    padding: 2,
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
