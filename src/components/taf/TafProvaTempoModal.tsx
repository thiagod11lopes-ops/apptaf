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
  SafeAreaView,
} from 'react-native';
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

  const cronometroParado =
    cronometroEstado === 'inicial' || cronometroEstado === 'finalizado';

  const mostrarCampoVoltas =
    (prova === 'corrida' || prova === 'caminhada') &&
    onChangeNumeroVoltas != null &&
    cronometroParado;

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
                <View
                  style={[
                    styles.metaPill,
                    { borderColor: theme.border, backgroundColor: theme.cardBg },
                  ]}
                >
                  <Text style={[styles.metaPillValue, { color: ui.text }]}>{tempoStr}</Text>
                </View>
              ) : null}
              {mostrarNota ? (
                <View
                  style={[
                    styles.metaPill,
                    { borderColor: theme.border, backgroundColor: theme.cardBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.metaPillValue,
                      { color: notaReprov ? theme.loss : ui.text },
                      notaReprov ? styles.notaReprov : null,
                    ]}
                    numberOfLines={1}
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
              nColunasVoltas > 0 &&
              onToggleVolta
                ? Array.from({ length: nColunasVoltas }, (__, v) => (
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
          {mostrarCampoVoltas ? (
            <View style={[styles.fieldVoltas, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Número de voltas</Text>
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
  fieldVoltas: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  voltasInput: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd - 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
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
  metaPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    minWidth: 40,
    alignItems: 'center',
  },
  metaPillValue: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  notaReprov: {
    fontSize: 8,
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
