import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Check, Pause, Play } from 'lucide-react-native';
import { PREMIUM } from '../theme/premium';

export type ResultadoPermanenciaOpcao = 'aprovado' | 'reprovado' | null;

export type CronometroPermanenciaEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

type ParticipantePermanencia = {
  index: number;
  nome: string;
};

type PermanenciaTafPanelProps = {
  participantes: ParticipantePermanencia[];
  resultados: ResultadoPermanenciaOpcao[];
  onToggleResultado: (index: number, opcao: 'aprovado' | 'reprovado') => void;
  tempoExibido: string;
  cronometroEstado: CronometroPermanenciaEstado;
  cronometroPausadoTexto: string;
  onCronometroPausadoTextoChange: (text: string) => void;
  onBlurCronometroPausado: () => void;
  onIniciarCronometro: () => void;
  onPararCronometro: () => void;
  onPausarCronometro: () => void;
  onContinuarCronometro: () => void;
  onAplicarResultado: () => void;
  salvando: boolean;
  erroAplicar?: string;
  inputBorder: string;
  inputBg: string;
  inputTextColor: string;
};

function CheckPermanencia({
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
  const onStyle = variant === 'aprovado' ? styles.checkOnAprovado : styles.checkOnReprovado;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, checked ? onStyle : styles.checkOff]}>
        {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.checkLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PermanenciaTafPanel({
  participantes,
  resultados,
  onToggleResultado,
  tempoExibido,
  cronometroEstado,
  cronometroPausadoTexto,
  onCronometroPausadoTextoChange,
  onBlurCronometroPausado,
  onIniciarCronometro,
  onPararCronometro,
  onPausarCronometro,
  onContinuarCronometro,
  onAplicarResultado,
  salvando,
  erroAplicar,
  inputBorder,
  inputBg,
  inputTextColor,
}: PermanenciaTafPanelProps) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const todosMarcados =
    participantes.length > 0 &&
    participantes.every((_, i) => resultados[i] === 'aprovado' || resultados[i] === 'reprovado');

  return (
    <View style={styles.root}>
      <Text style={[styles.subtitle, { color: ui.text }]}>
        Marque Aprovado ou Reprovado para cada militar. O cronômetro encerra aos 10 minutos.
      </Text>

      <ScrollView style={styles.listaScroll} nestedScrollEnabled>
        {participantes.map((p) => {
          const r = resultados[p.index] ?? null;
          return (
            <View
              key={p.index}
              style={[
                styles.participanteCard,
                { borderColor: theme.border, backgroundColor: ui.inputBg },
              ]}
            >
              <View style={styles.participanteHeader}>
                <Text style={[styles.participanteNumero, { color: ui.text }]}>{p.index + 1}</Text>
                <Text style={[styles.participanteNome, { color: ui.text }]} numberOfLines={2}>
                  {p.nome}
                </Text>
              </View>
              <View style={styles.checksRow}>
                <CheckPermanencia
                  label="Aprovado"
                  checked={r === 'aprovado'}
                  variant="aprovado"
                  labelColor={ui.text}
                  onPress={() => onToggleResultado(p.index, 'aprovado')}
                />
                <CheckPermanencia
                  label="Reprovado"
                  checked={r === 'reprovado'}
                  variant="reprovado"
                  labelColor={ui.text}
                  onPress={() => onToggleResultado(p.index, 'reprovado')}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.cronometroBloco}>
        <View style={styles.cronometroRow}>
          {cronometroEstado === 'inicial' || cronometroEstado === 'finalizado' ? (
            <TouchableOpacity
              accessibilityLabel="Iniciar permanência"
              activeOpacity={0.85}
              onPress={onIniciarCronometro}
              style={styles.btnCronometro}
            >
              <Text style={styles.btnCronometroText}>Iniciar Permanência</Text>
            </TouchableOpacity>
          ) : null}
          {cronometroEstado === 'rodando' || cronometroEstado === 'pausado' ? (
            <TouchableOpacity
              accessibilityLabel="Parar permanência"
              activeOpacity={0.85}
              onPress={onPararCronometro}
              style={styles.btnCronometro}
            >
              <Text style={styles.btnCronometroText}>Parar</Text>
            </TouchableOpacity>
          ) : null}
          {cronometroEstado === 'rodando' ? (
            <TouchableOpacity
              accessibilityLabel="Pausar cronômetro"
              activeOpacity={0.85}
              onPress={onPausarCronometro}
              style={[styles.btnIcon, { borderColor: theme.border, backgroundColor: ui.inputBg }]}
            >
              <Pause size={22} color={ui.iconStrong} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
          {cronometroEstado === 'pausado' ? (
            <TouchableOpacity
              accessibilityLabel="Continuar cronômetro"
              activeOpacity={0.85}
              onPress={onContinuarCronometro}
              style={[styles.btnIcon, { borderColor: theme.border, backgroundColor: ui.inputBg }]}
            >
              <Play size={22} color={ui.iconStrong} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.cronometroBox, { borderColor: inputBorder, backgroundColor: inputBg }]}>
            {cronometroEstado === 'pausado' ? (
              <TextInput
                value={cronometroPausadoTexto}
                onChangeText={onCronometroPausadoTextoChange}
                onBlur={onBlurCronometroPausado}
                placeholder="MM:SS"
                placeholderTextColor={ui.placeholder}
                style={[styles.cronometroInput, { color: inputTextColor }]}
              />
            ) : (
              <Text
                style={[
                  styles.cronometroText,
                  { color: inputTextColor },
                  Platform.OS === 'web' ? ({ fontVariantNumeric: 'tabular-nums' } as object) : null,
                ]}
              >
                {tempoExibido}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.limiteHint, { color: ui.text }]}>Limite da prova: 10:00</Text>
      </View>

      {erroAplicar ? <Text style={[styles.erroText, { color: ui.text }]}>{erroAplicar}</Text> : null}

      {todosMarcados ? (
        <TouchableOpacity
          accessibilityLabel="Aplicar resultado da permanência"
          activeOpacity={0.85}
          onPress={onAplicarResultado}
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  subtitle: {
    fontSize: 13,
    color: 'rgba(17,24,39,0.65)',
    lineHeight: 18,
  },
  listaScroll: { maxHeight: 360 },
  participanteCard: {
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  participanteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  participanteNumero: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803D',
    minWidth: 28,
  },
  participanteNome: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  checksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    borderColor: 'rgba(17,24,39,0.22)',
    backgroundColor: 'transparent',
  },
  checkOnAprovado: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  checkOnReprovado: {
    borderColor: '#B91C1C',
    backgroundColor: '#B91C1C',
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cronometroBloco: { marginTop: 4, gap: 6 },
  cronometroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  btnCronometro: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnCronometroText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  btnIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cronometroBox: {
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cronometroText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cronometroInput: {
    fontSize: 28,
    fontWeight: '900',
    minWidth: 88,
    textAlign: 'center',
    padding: 0,
  },
  limiteHint: {
    fontSize: 12,
    color: 'rgba(17,24,39,0.5)',
    fontWeight: '600',
  },
  erroText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  btnAplicar: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnAplicarText: {
    fontWeight: '700',
  },
  btnDisabled: { opacity: 0.6 },
});
