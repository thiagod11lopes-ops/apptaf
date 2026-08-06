import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { HeartPulse, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import type { AppTheme } from '../../../theme/premium';
import { PREMIUM } from '../../../theme/premium';
import { LabelNip } from '../../LabelNip';
import { AplicarTafInput, AplicarTafPrimaryButton } from './AplicarTafUi';
import { FATORES_RISCO_LARANJA } from './FatoresRiscoInfoModal';
import type { CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import { idadeFromDataNascimento } from '../../../utils/idadeFromDataNascimento';
import { cadastroPrecisaVinculo } from '../../../utils/cadastroDadosTaf';
import {
  VinculoCarreiraRm2Checks,
  type VinculoMilitar,
} from './VinculoCarreiraRm2Checks';

export type NipFeedbackLinha =
  | {
      tipo: 'ok';
      texto: string;
      nomeMilitar: string;
      /** Nome sem posto (edição / persistência). */
      nome: string;
      categoria: 'Oficiais' | 'Praças';
      oficial?: string;
      praca?: string;
      dataNascimento: string;
      sexo?: 'M' | 'F';
      vinculo?: 'carreira' | 'rm2';
    }
  | {
      tipo: 'completar_dados';
      nomeMilitar: string;
      nome: string;
      categoria: 'Oficiais' | 'Praças';
      oficial?: string;
      praca?: string;
      cadastro: CadastroItemPersist;
      dataNascimento: string;
      sexo: 'M' | 'F';
      /** Preenchido quando o cadastro ainda não tem Carreira/RM2. */
      vinculo?: VinculoMilitar | null;
      erro?: string;
    }
  | { tipo: 'erro'; texto: string }
  | null;

export type AplicarTafNipsListProps = {
  nips: string[];
  feedbackLinhas: NipFeedbackLinha[];
  demoAtivo: boolean;
  labelAtleta: string;
  onAtualizarNip: (index: number, texto: string) => void;
  onVerificarNip: (index: number) => void;
  onRemoverPress: (index: number) => void;
  onEditarMilitar: (index: number) => void;
  onAtualizarDados: (
    index: number,
    patch: { dataNascimento?: string; sexo?: 'M' | 'F'; vinculo?: VinculoMilitar | null },
  ) => void;
  onConfirmarDados: (index: number) => void | Promise<void>;
  participanteTemFatorRisco: (index: number) => boolean;
  participanteCadastradoFatoresRisco: (index: number) => boolean;
  onPressFatoresRisco: (index: number) => void;
  onAbrirInfoFatoresRisco: (index: number) => void;
};

/** Sufixo de idade ao lado do nome. */
function textoIdadeMilitar(dataNascimento: string): string {
  const idade = idadeFromDataNascimento(dataNascimento);
  return idade != null ? `${idade} anos` : 'Idade?';
}

function textoGeneroMilitar(sexo?: 'M' | 'F'): string {
  if (sexo === 'M') return 'Masculino';
  if (sexo === 'F') return 'Feminino';
  return 'Gênero?';
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

const NipRowSeparator = () => <View style={styles.separator} />;

type NipParticipanteRowProps = {
  index: number;
  nip: string;
  fb: NipFeedbackLinha;
  demoAtivo: boolean;
  labelAtleta: string;
  theme: AppTheme;
  ui: ReturnType<typeof getUiColors>;
  rowStyles: ReturnType<typeof createNipsListStyles>;
  inputBg: string;
  inputBorder: string;
  selectedBgColor: string;
  selectedTextColor: string;
  onAtualizarNip: (index: number, texto: string) => void;
  onVerificarNip: (index: number) => void;
  onRemoverPress: (index: number) => void;
  onEditarMilitar: (index: number) => void;
  onAtualizarDados: (
    index: number,
    patch: { dataNascimento?: string; sexo?: 'M' | 'F'; vinculo?: VinculoMilitar | null },
  ) => void;
  onConfirmarDados: (index: number) => void | Promise<void>;
  participanteTemFatorRisco: (index: number) => boolean;
  participanteCadastradoFatoresRisco: (index: number) => boolean;
  onPressFatoresRisco: (index: number) => void;
  onAbrirInfoFatoresRisco: (index: number) => void;
};

const NipParticipanteRow = memo(function NipParticipanteRow({
  index,
  nip,
  fb,
  demoAtivo,
  labelAtleta,
  theme,
  ui,
  rowStyles,
  inputBg,
  inputBorder,
  selectedBgColor,
  selectedTextColor,
  onAtualizarNip,
  onVerificarNip,
  onRemoverPress,
  onEditarMilitar,
  onAtualizarDados,
  onConfirmarDados,
  participanteTemFatorRisco,
  participanteCadastradoFatoresRisco,
  onPressFatoresRisco,
  onAbrirInfoFatoresRisco,
}: NipParticipanteRowProps) {
  const ts = theme.textStyles;
  const temFatorRisco = participanteTemFatorRisco(index);

  return (
    <View
      style={[
        rowStyles.nipGlassPanel,
        {
          borderColor: theme.border,
          backgroundColor: theme.isDark ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.5)',
        },
      ]}
    >
      <View style={rowStyles.nipFieldBlock}>
        <View style={rowStyles.nipLabelRow}>
          <LabelNip color={ui.label} fontSize={11} fontWeight="800" />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remover participante ${index + 1}`}
            onPress={() => onRemoverPress(index)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={rowStyles.nipTrashBtn}
          >
            <Trash2 size={18} color={theme.loss} strokeWidth={2.3} />
          </TouchableOpacity>
        </View>
        <View style={rowStyles.nipInputRow}>
          <AplicarTafInput
            value={nip}
            onChangeText={(t) => onAtualizarNip(index, t)}
            placeholder="00.0000.00"
            keyboardType="number-pad"
            style={[rowStyles.inputNipFlex, demoAtivo ? { opacity: 0.85 } : null]}
            autoCorrect={false}
            spellCheck={false}
            editable={!demoAtivo}
            accessibilityLabel={`NIP do participante ${index + 1}`}
            accessibilityState={{ disabled: demoAtivo }}
          />
          {!demoAtivo ? (
            <TouchableOpacity
              accessibilityLabel={`Confirmar NIP do participante ${index + 1}`}
              activeOpacity={0.9}
              onPress={() => onVerificarNip(index)}
              style={rowStyles.nipOkBtnWrap}
            >
              <LinearGradient
                colors={[theme.primary, '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={rowStyles.nipOkBtn}
              >
                <Text style={[rowStyles.nipOkBtnText, { color: theme.tokens.textOnPrimary }]}>
                  OK
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {fb?.tipo === 'ok' ? (
        <View
          style={[
            rowStyles.militarIdentityCard,
            temFatorRisco
              ? {
                  borderColor: theme.isDark ? 'rgba(234,88,12,0.55)' : 'rgba(234,88,12,0.45)',
                  borderWidth: 2,
                  backgroundColor: theme.isDark ? 'rgba(234,88,12,0.1)' : 'rgba(255,247,237,0.85)',
                }
              : {
                  borderColor: theme.isDark ? 'rgba(34,197,94,0.35)' : 'rgba(22,163,74,0.22)',
                  backgroundColor: theme.isDark ? 'rgba(34,197,94,0.08)' : 'rgba(220,252,231,0.45)',
                },
          ]}
        >
          <LinearGradient
            colors={
              temFatorRisco
                ? theme.isDark
                  ? ['rgba(234,88,12,0.55)', 'rgba(251,146,60,0.25)']
                  : ['rgba(234,88,12,0.7)', 'rgba(251,146,60,0.4)']
                : theme.isDark
                  ? ['rgba(34,197,94,0.35)', 'rgba(56,189,248,0.2)']
                  : ['rgba(34,197,94,0.55)', 'rgba(37,99,235,0.35)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={rowStyles.militarIdentityStripe}
          />
          <View style={rowStyles.militarIdentityRow}>
            <View
              style={[
                rowStyles.militarNumOrb,
                {
                  backgroundColor: temFatorRisco
                    ? theme.isDark
                      ? 'rgba(234,88,12,0.22)'
                      : 'rgba(254,215,170,0.7)'
                    : theme.isDark
                      ? 'rgba(34,197,94,0.22)'
                      : PREMIUM.accentMuted,
                },
              ]}
            >
              <Text
                style={[
                  rowStyles.militarNumOrbText,
                  { color: temFatorRisco ? FATORES_RISCO_LARANJA : theme.success },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={rowStyles.militarNomeCol}>
              <Text style={[rowStyles.militarRoleLabel, { color: theme.textSecondary }]}>
                {labelAtleta}
              </Text>
              <Text
                accessibilityRole={!demoAtivo ? 'button' : undefined}
                accessibilityLabel="Editar dados do militar"
                accessibilityHint={
                  !demoAtivo ? 'Abre edição de categoria, nome, idade e gênero' : undefined
                }
                onPress={
                  !demoAtivo
                    ? () => onEditarMilitar(index)
                    : temFatorRisco
                      ? () => onAbrirInfoFatoresRisco(index)
                      : undefined
                }
                style={[
                  rowStyles.militarNomeText,
                  {
                    color: temFatorRisco ? FATORES_RISCO_LARANJA : ui.text,
                    textDecorationLine:
                      !demoAtivo || temFatorRisco ? 'underline' : 'none',
                  },
                ]}
                numberOfLines={2}
              >
                {fb.nomeMilitar}
              </Text>
              <View style={rowStyles.militarMetaRow}>
                {demoAtivo ? (
                  <>
                    <View
                      style={[
                        rowStyles.militarMetaChip,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.04)',
                          opacity: 0.9,
                        },
                      ]}
                      accessibilityLabel={`Idade: ${textoIdadeMilitar(fb.dataNascimento)}`}
                    >
                      <Text
                        style={[rowStyles.militarMetaChipText, { color: theme.textSecondary }]}
                      >
                        {textoIdadeMilitar(fb.dataNascimento)}
                      </Text>
                    </View>
                    <View
                      style={[
                        rowStyles.militarMetaChip,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.04)',
                          opacity: 0.9,
                        },
                      ]}
                      accessibilityLabel={`Gênero: ${textoGeneroMilitar(fb.sexo)}`}
                    >
                      <Text
                        style={[rowStyles.militarMetaChipText, { color: theme.textSecondary }]}
                      >
                        {textoGeneroMilitar(fb.sexo)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Editar idade"
                      accessibilityHint="Abre edição dos dados do militar"
                      onPress={() => onEditarMilitar(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={[
                        rowStyles.militarMetaChip,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.04)',
                        },
                      ]}
                    >
                      <Text
                        style={[rowStyles.militarMetaChipText, { color: theme.textSecondary }]}
                      >
                        {textoIdadeMilitar(fb.dataNascimento)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Editar gênero"
                      accessibilityHint="Abre edição dos dados do militar"
                      onPress={() => onEditarMilitar(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={[
                        rowStyles.militarMetaChip,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.04)',
                        },
                      ]}
                    >
                      <Text
                        style={[rowStyles.militarMetaChipText, { color: theme.textSecondary }]}
                      >
                        {textoGeneroMilitar(fb.sexo)}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
            {(() => {
              const frCadastrado = participanteCadastradoFatoresRisco(index);
              const frCor = frCadastrado ? theme.success : FATORES_RISCO_LARANJA;
              const frBg = frCadastrado
                ? theme.isDark
                  ? 'rgba(34,197,94,0.16)'
                  : 'rgba(220,252,231,0.95)'
                : theme.isDark
                  ? 'rgba(234,88,12,0.18)'
                  : 'rgba(255,247,237,0.95)';
              const frBorder = frCadastrado
                ? theme.isDark
                  ? 'rgba(34,197,94,0.45)'
                  : 'rgba(34,197,94,0.35)'
                : theme.isDark
                  ? 'rgba(234,88,12,0.5)'
                  : 'rgba(234,88,12,0.4)';
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    frCadastrado
                      ? `Fatores de risco cadastrados — participante ${index + 1}`
                      : `Fatores de risco pendentes — participante ${index + 1}`
                  }
                  accessibilityHint={
                    frCadastrado
                      ? 'Abre a página para editar os fatores de risco'
                      : 'Abre a página para cadastrar os fatores de risco'
                  }
                  onPress={() => onPressFatoresRisco(index)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.82}
                  style={[
                    rowStyles.militarFatoresIconBtn,
                    {
                      borderColor: frBorder,
                      backgroundColor: frBg,
                      shadowColor: frCor,
                    },
                  ]}
                >
                  <View
                    style={[rowStyles.militarFatoresIconGlow, { backgroundColor: frCor }]}
                  />
                  <HeartPulse size={20} color={frCor} strokeWidth={2.35} />
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>
      ) : null}

      {fb?.tipo === 'completar_dados' ? (
        <View
          style={[rowStyles.dadosNipBox, { backgroundColor: inputBg, borderColor: inputBorder }]}
        >
          <Text style={[ts.bodySecondary, rowStyles.dadosNipLead]}>
            {fb.nomeMilitar}: informe data de nascimento
            {cadastroPrecisaVinculo(fb.cadastro) ? ', Carreira ou RM2' : ''} e gênero. Os dados serão
            salvos no cadastro.
          </Text>
          <Text style={[ts.label, rowStyles.dadosNipFieldLabel]}>Data de nascimento</Text>
          <View style={rowStyles.dadosNipDnRow}>
            <View style={rowStyles.dadosNipDnInput}>
              <AplicarTafInput
                value={fb.dataNascimento}
                onChangeText={(t) =>
                  onAtualizarDados(index, { dataNascimento: formatDateInput(t) })
                }
                placeholder="DD/MM/AAAA"
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                inputMode="numeric"
                maxLength={10}
                accessibilityLabel={`Data de nascimento do participante ${index + 1}`}
              />
            </View>
            {cadastroPrecisaVinculo(fb.cadastro) ? (
              <VinculoCarreiraRm2Checks
                value={fb.vinculo ?? null}
                onChange={(next) => onAtualizarDados(index, { vinculo: next })}
              />
            ) : null}
          </View>
          <Text style={[ts.label, rowStyles.dadosNipFieldLabel]}>Gênero</Text>
          <View style={[rowStyles.dadosNipSegmented, { borderColor: theme.border }]}>
            {(['M', 'F'] as const).map((sx) => {
              const active = fb.sexo === sx;
              return (
                <TouchableOpacity
                  key={sx}
                  accessibilityLabel={sx === 'M' ? 'Masculino' : 'Feminino'}
                  onPress={() => onAtualizarDados(index, { sexo: sx })}
                  style={[
                    rowStyles.dadosNipSegmentBtn,
                    {
                      backgroundColor: active ? selectedBgColor : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      ts.caption,
                      { color: active ? selectedTextColor : theme.textSecondary },
                      rowStyles.dadosNipSegmentText,
                    ]}
                  >
                    {sx === 'M' ? 'Masculino' : 'Feminino'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {fb.erro ? <Text style={rowStyles.feedbackErro}>{fb.erro}</Text> : null}
          <AplicarTafPrimaryButton
            label="Salvar e confirmar"
            onPress={() => void onConfirmarDados(index)}
          />
        </View>
      ) : fb ? (
        <Text style={fb.tipo === 'ok' ? rowStyles.feedbackOk : rowStyles.feedbackErro}>
          {fb.tipo === 'ok' || fb.tipo === 'erro' ? fb.texto : ''}
        </Text>
      ) : null}
    </View>
  );
});

export function AplicarTafNipsList({
  nips,
  feedbackLinhas,
  demoAtivo,
  labelAtleta,
  onAtualizarNip,
  onVerificarNip,
  onRemoverPress,
  onEditarMilitar,
  onAtualizarDados,
  onConfirmarDados,
  participanteTemFatorRisco,
  participanteCadastradoFatoresRisco,
  onPressFatoresRisco,
  onAbrirInfoFatoresRisco,
}: AplicarTafNipsListProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const rowStyles = useMemo(() => createNipsListStyles(theme, ui), [theme, ui]);
  const selectedBgColor = theme.primary;
  const selectedTextColor = theme.text;
  const inputBg = theme.cardBg;
  const inputBorder = ui.inputBorder;

  const extraData = useMemo(
    () => ({ feedbackLinhas, demoAtivo }),
    [feedbackLinhas, demoAtivo],
  );

  const renderItem = useCallback(
    ({ item: nip, index }: { item: string; index: number }) => (
      <NipParticipanteRow
        index={index}
        nip={nip}
        fb={feedbackLinhas[index] ?? null}
        demoAtivo={demoAtivo}
        labelAtleta={labelAtleta}
        theme={theme}
        ui={ui}
        rowStyles={rowStyles}
        inputBg={inputBg}
        inputBorder={inputBorder}
        selectedBgColor={selectedBgColor}
        selectedTextColor={selectedTextColor}
        onAtualizarNip={onAtualizarNip}
        onVerificarNip={onVerificarNip}
        onRemoverPress={onRemoverPress}
        onEditarMilitar={onEditarMilitar}
        onAtualizarDados={onAtualizarDados}
        onConfirmarDados={onConfirmarDados}
        participanteTemFatorRisco={participanteTemFatorRisco}
        participanteCadastradoFatoresRisco={participanteCadastradoFatoresRisco}
        onPressFatoresRisco={onPressFatoresRisco}
        onAbrirInfoFatoresRisco={onAbrirInfoFatoresRisco}
      />
    ),
    [
      feedbackLinhas,
      demoAtivo,
      labelAtleta,
      theme,
      ui,
      rowStyles,
      inputBg,
      inputBorder,
      selectedBgColor,
      selectedTextColor,
      onAtualizarNip,
      onVerificarNip,
      onRemoverPress,
      onEditarMilitar,
      onAtualizarDados,
      onConfirmarDados,
      participanteTemFatorRisco,
      participanteCadastradoFatoresRisco,
      onPressFatoresRisco,
      onAbrirInfoFatoresRisco,
    ],
  );

  const keyExtractor = useCallback((_nip: string, index: number) => `nip-row-${index}`, []);

  /**
   * No web/PWA o scroll aninhado da FlatList costuma falhar no standalone.
   * Expandimos a lista na página e o ScrollView pai (com scrollIntoView) cuida do foco.
   */
  if (Platform.OS === 'web') {
    return (
      <View style={styles.listWeb}>
        {nips.map((nip, index) => (
          <View key={keyExtractor(nip, index)}>
            {index > 0 ? <NipRowSeparator /> : null}
            {renderItem({ item: nip, index })}
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={nips}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      extraData={extraData}
      nestedScrollEnabled
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      ItemSeparatorComponent={NipRowSeparator}
      style={styles.list}
      scrollEnabled={nips.length > 0}
    />
  );
}

function createNipsListStyles(theme: AppTheme, ui: ReturnType<typeof getUiColors>) {
  return StyleSheet.create({
    nipGlassPanel: {
      borderWidth: 1,
      borderRadius: PREMIUM.radiusMd + 2,
      padding: 12,
      gap: 10,
    },
    nipFieldBlock: {
      gap: 6,
    },
    nipLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    nipTrashBtn: {
      padding: 4,
      borderRadius: 8,
    },
    nipInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    nipOkBtnWrap: {
      width: 56,
      height: 48,
      borderRadius: PREMIUM.radiusMd + 2,
      overflow: 'hidden',
      flexShrink: 0,
    },
    nipOkBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nipOkBtnText: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    inputNipFlex: {
      flex: 1,
      minWidth: 0,
      marginTop: 0,
      paddingVertical: 12,
    },
    militarIdentityCard: {
      borderWidth: 1,
      borderRadius: PREMIUM.radiusMd,
      overflow: 'hidden',
    },
    militarIdentityStripe: {
      height: 2,
      width: '100%',
    },
    militarIdentityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    militarNumOrb: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    militarNumOrbText: {
      fontSize: 16,
      fontWeight: '900',
    },
    militarNomeCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    militarRoleLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    militarNomeText: {
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    militarMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    militarMetaChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
    },
    militarMetaChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    militarFatoresIconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 3,
    },
    militarFatoresIconGlow: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderRadius: 11,
      opacity: 0.18,
    },
    feedbackOk: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '700',
      color: theme.isDark ? ui.text : theme.success,
    },
    feedbackErro: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '700',
      color: theme.isDark ? ui.text : '#B91C1C',
    },
    dadosNipBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: PREMIUM.radiusMd,
      borderWidth: 1,
      gap: 8,
    },
    dadosNipLead: {
      lineHeight: 18,
    },
    dadosNipFieldLabel: {
      marginTop: 4,
      marginBottom: 0,
    },
    dadosNipDnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dadosNipDnInput: {
      flex: 1,
      minWidth: 0,
    },
    dadosNipSegmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: PREMIUM.radiusMd,
      overflow: 'hidden',
    },
    dadosNipSegmentBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dadosNipSegmentText: {
      fontWeight: '700',
    },
  });
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 520,
  },
  listWeb: {
    width: '100%',
  },
  separator: {
    height: 10,
  },
});
