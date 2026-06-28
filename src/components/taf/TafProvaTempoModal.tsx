import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { TafCronometroPanel, type TafCronometroEstado } from './TafCronometroPanel';
import type { ResultadoPermanenciaOpcao } from '../PermanenciaTafPanel';

export type TafProvaTempoModalProva = 'corrida' | 'caminhada' | 'natacao' | 'permanencia';

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

function CheckVolta({
  checked,
  onPress,
  label,
  a11y,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  a11y: string;
}) {
  return (
    <View style={styles.checkCol}>
      <Text style={styles.checkColLabel}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={a11y}
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.checkOuter}
      >
        <View style={[styles.checkBox, checked ? styles.checkBoxOn : styles.checkBoxOff]}>
          {checked ? <Check size={12} color="#FFFFFF" strokeWidth={2.8} /> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function CheckPermanenciaModal({
  label,
  checked,
  onPress,
  variant,
  labelColor,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  variant: 'aprovado' | 'reprovado';
  labelColor: string;
}) {
  const onStyle = variant === 'aprovado' ? styles.checkPermOnAprov : styles.checkPermOnReprov;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.checkPermRow}
    >
      <View style={[styles.checkPermBox, checked ? onStyle : styles.checkPermOff]}>
        {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.checkPermLabel, { color: labelColor }]}>{label}</Text>
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
  const { theme, isDark } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const ts = theme.textStyles;
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.min(windowHeight * 0.92, 860);

  const subtitulo =
    prova === 'permanencia'
      ? 'Marque Aprovado ou Reprovado. O cronômetro encerra aos 10 minutos.'
      : prova === 'natacao'
        ? 'Marque a chegada de cada nadador para registrar o tempo.'
        : 'Marque as voltas; na última volta o tempo é registrado automaticamente.';

  const mostrarCampoVoltas =
    (prova === 'corrida' || prova === 'caminhada') && onChangeNumeroVoltas != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={isDark ? 48 : 32}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Fechar modal da prova" />

        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
            Platform.OS === 'web' ? ({ boxShadow: theme.tokens.shadowCardHover } as object) : null,
          ]}
        >
          <LinearGradient
            colors={isDark ? ['#1e3a5f', '#0f172a'] : ['#1d4ed8', '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerKicker}>{tituloProva.toUpperCase()} · TEMPO OFICIAL</Text>
                <Text style={styles.headerTitle}>{tituloProva} preparada</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Voltar para edição dos NIPs"
                activeOpacity={0.88}
                onPress={onClose}
                style={styles.closeBtn}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSub}>{subtitulo}</Text>
          </LinearGradient>

          <ScrollView
            style={[styles.scroll, { maxHeight: sheetMaxHeight - 132 }]}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mostrarCampoVoltas ? (
              <View style={[styles.fieldCard, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>NÚMERO DE VOLTAS</Text>
                <TextInput
                  value={numeroVoltas}
                  onChangeText={onChangeNumeroVoltas}
                  placeholder="0"
                  placeholderTextColor={ui.placeholder}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[
                    styles.voltasInput,
                    {
                      borderColor: ui.inputBorder,
                      backgroundColor: theme.cardBg,
                      color: ui.text,
                    },
                  ]}
                  autoCorrect={false}
                  spellCheck={false}
                  accessibilityLabel={
                    prova === 'caminhada'
                      ? 'Número de voltas da caminhada'
                      : 'Número de voltas da corrida'
                  }
                />
              </View>
            ) : null}

            <TafCronometroPanel
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
              footer={
                podeAplicar ? (
                  <TouchableOpacity
                    accessibilityLabel={`Aplicar resultado da ${tituloProva.toLowerCase()}`}
                    activeOpacity={0.85}
                    onPress={onAplicar}
                    disabled={salvando}
                    style={[
                      styles.btnAplicar,
                      { backgroundColor: theme.primary },
                      salvando ? styles.btnDisabled : null,
                    ]}
                  >
                    {salvando ? (
                      <ActivityIndicator color={theme.tokens.textOnPrimary} />
                    ) : (
                      <Text style={[ts.body, styles.btnAplicarText, { color: theme.tokens.textOnPrimary }]}>
                        Aplicar Resultado
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />

            <Text style={[styles.listTitle, { color: ui.text }]}>
              {prova === 'permanencia' ? 'Participantes' : `${labelAtleta}s`}
            </Text>

            {Array.from({ length: nParticipantes }, (_, index) => {
              const nome = nomesParticipantes[index] ?? '—';
              const tempoMs = temposMilitaresMs[index];
              const tempoStr = tempoMs != null ? formatMs(tempoMs) : '—';
              const nota = getNota?.(index) ?? '—';
              const notaReprov = isNotaReprovado?.(index) ?? false;

              return (
                <View
                  key={`prov-modal-${index}`}
                  style={[
                    styles.participantCard,
                    { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.participantTopRow}>
                    <View style={[styles.numBadge, { backgroundColor: theme.isDark ? 'rgba(34,197,94,0.2)' : PREMIUM.accentMuted }]}>
                      <Text style={[styles.numBadgeText, { color: theme.success }]}>{index + 1}</Text>
                    </View>
                    <Text style={[styles.participantNome, { color: ui.text }]} numberOfLines={2}>
                      {nome}
                    </Text>
                    {mostrarTempo ? (
                      <View style={[styles.metaPill, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                        <Text style={[styles.metaPillLabel, { color: theme.textMuted }]}>Tempo</Text>
                        <Text style={[styles.metaPillValue, { color: ui.text }]}>{tempoStr}</Text>
                      </View>
                    ) : null}
                    {mostrarNota ? (
                      <View style={[styles.metaPill, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                        <Text style={[styles.metaPillLabel, { color: theme.textMuted }]}>Nota</Text>
                        <Text
                          style={[
                            styles.metaPillValue,
                            { color: notaReprov ? theme.loss : ui.text },
                            notaReprov ? styles.notaReprov : null,
                          ]}
                          numberOfLines={2}
                        >
                          {nota}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.checksRow}>
                    {prova === 'permanencia' && onTogglePermanencia ? (
                      <>
                        <CheckPermanenciaModal
                          label="Aprovado"
                          checked={resultadosPermanencia[index] === 'aprovado'}
                          variant="aprovado"
                          labelColor={ui.text}
                          onPress={() => onTogglePermanencia(index, 'aprovado')}
                        />
                        <CheckPermanenciaModal
                          label="Reprovado"
                          checked={resultadosPermanencia[index] === 'reprovado'}
                          variant="reprovado"
                          labelColor={ui.text}
                          onPress={() => onTogglePermanencia(index, 'reprovado')}
                        />
                      </>
                    ) : null}

                    {prova === 'natacao' && onToggleChegada ? (
                      <CheckVolta
                        checked={chegadaNatacao[index] ?? false}
                        label="Chegada"
                        a11y={`Marcar chegada, ${labelAtleta} ${index + 1}`}
                        onPress={() => onToggleChegada(index)}
                      />
                    ) : null}

                    {(prova === 'corrida' || prova === 'caminhada') &&
                    nColunasVoltas > 0 &&
                    onToggleVolta
                      ? Array.from({ length: nColunasVoltas }, (__, v) => (
                          <CheckVolta
                            key={`volta-${index}-${v}`}
                            checked={checksVoltas[index]?.[v] ?? false}
                            label={`V${v + 1}`}
                            a11y={`Volta ${v + 1}, participante ${index + 1}`}
                            onPress={() => onToggleVolta(index, v)}
                          />
                        ))
                      : null}
                  </View>
                </View>
              );
            })}

            {erroAplicar ? (
              <Text style={[styles.erroText, { color: theme.loss }]}>{erroAplicar}</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Platform.select({
      web: 'rgba(15, 23, 42, 0.55)',
      default: 'rgba(15, 23, 42, 0.35)',
    }),
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  headerKicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 4,
  },
  fieldCard: {
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  voltasInput: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  participantCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 4,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: {
    fontSize: 16,
    fontWeight: '900',
  },
  participantNome: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 58,
    alignItems: 'center',
  },
  metaPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaPillValue: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  notaReprov: {
    fontSize: 9,
  },
  checksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 12,
    paddingLeft: 44,
  },
  checkCol: {
    alignItems: 'center',
    gap: 6,
  },
  checkColLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(100, 116, 139, 0.95)',
    letterSpacing: 0.2,
  },
  checkOuter: {
    padding: 2,
  },
  checkBox: {
    width: 28,
    height: 28,
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
  },
  checkPermBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
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
  checkPermLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnAplicar: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnAplicarText: {
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.72,
  },
  erroText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
