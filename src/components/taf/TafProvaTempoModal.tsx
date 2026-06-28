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
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { TafCronometroPanel, type TafCronometroEstado } from './TafCronometroPanel';
import { TafVoltasPromptOverlay } from './TafVoltasPromptOverlay';
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

function MetaResultadoField({
  label,
  value,
  tone,
  theme,
  ui,
}: {
  label: string;
  value: string;
  tone: 'tempo' | 'nota' | 'notaReprov';
  theme: ReturnType<typeof useTheme>['theme'];
  ui: ReturnType<typeof getUiColors>;
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

  return (
    <View
      style={[styles.metaField, { borderColor }]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFill} />
      <Text style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          { color: valueColor },
          tone === 'notaReprov' ? styles.metaValueReprov : null,
        ]}
        numberOfLines={1}
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
}: {
  checked: boolean;
  onPress: () => void;
  a11y: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={a11y}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.checkOuter}
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
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  variant: 'aprovado' | 'reprovado';
}) {
  const onStyle = variant === 'aprovado' ? styles.checkPermOnAprov : styles.checkPermOnReprov;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.checkPermOuter}
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

  const tituloModal = `${tituloProva} preparada`;

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

        return (
          <View
            key={`prov-modal-${index}`}
            style={[
              styles.participantCard,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <View style={styles.participantTopRow}>
              <View
                style={[
                  styles.numBadge,
                  { backgroundColor: theme.isDark ? 'rgba(34,197,94,0.2)' : PREMIUM.accentMuted },
                ]}
              >
                <Text style={[styles.numBadgeText, { color: theme.success }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.participantNome, { color: ui.text }]} numberOfLines={2}>
                {nome}
              </Text>
              {mostrarTempo ? (
                <MetaResultadoField
                  label="Tempo"
                  value={tempoStr}
                  tone="tempo"
                  theme={theme}
                  ui={ui}
                />
              ) : null}
              {mostrarNota ? (
                <MetaResultadoField
                  label="Nota"
                  value={nota}
                  tone={notaReprov ? 'notaReprov' : 'nota'}
                  theme={theme}
                  ui={ui}
                />
              ) : null}
            </View>

            <View style={styles.checksRow}>
              {prova === 'permanencia' && onTogglePermanencia ? (
                <>
                  <CheckPermanenciaModal
                    label="Aprovado"
                    checked={resultadosPermanencia[index] === 'aprovado'}
                    variant="aprovado"
                    onPress={() => onTogglePermanencia(index, 'aprovado')}
                  />
                  <CheckPermanenciaModal
                    label="Reprovado"
                    checked={resultadosPermanencia[index] === 'reprovado'}
                    variant="reprovado"
                    onPress={() => onTogglePermanencia(index, 'reprovado')}
                  />
                </>
              ) : null}

              {prova === 'natacao' && onToggleChegada ? (
                <CheckVolta
                  checked={chegadaNatacao[index] ?? false}
                  a11y={`Marcar chegada, ${labelAtleta} ${index + 1}`}
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
                      onPress={() => onToggleVolta(index, v)}
                    />
                  ))
                : null}
            </View>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.cardBg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: ui.text }]} numberOfLines={1}>
            {tituloModal}
          </Text>
          <TouchableOpacity
            accessibilityLabel="Fechar modal da prova"
            activeOpacity={0.88}
            onPress={onClose}
            style={[styles.closeBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
          >
            <X size={22} color={ui.iconStrong} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {participantesList}
          {erroAplicar ? (
            <Text style={[styles.erroText, { color: theme.loss }]}>{erroAplicar}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.cardBg }]}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    paddingRight: 8,
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    gap: 4,
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  numBadge: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  participantNome: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  metaField: {
    minWidth: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingTop: 4,
    paddingBottom: 5,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 1,
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
  metaLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 0.2,
  },
  metaValueReprov: {
    fontSize: 9,
  },
  checksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 24,
  },
  checkOuter: {
    padding: 2,
  },
  checkBox: {
    width: 32,
    height: 32,
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
    width: 32,
    height: 32,
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
  btnAplicar: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
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
