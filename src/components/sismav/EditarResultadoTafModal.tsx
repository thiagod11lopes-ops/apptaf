import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AppModal } from '../premium/AppModal';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import {
  formatMinutosSegundosInput,
  tempoParaExibicao,
} from '../../utils/formatMinutosSegundos';
import {
  salvarResultadosTafEditados,
  type EdicaoResultadoTafInput,
} from '../../utils/atualizarResultadoTaf';
import { idadeFromDataNascimento } from '../../utils/idadeFromDataNascimento';
import { PREMIUM } from '../../theme/premium';

type Props = {
  visible: boolean;
  cadastro: CadastroItemPersist | null;
  onClose: () => void;
  onSalvo: (atualizado: CadastroItemPersist) => void;
};

function permanenciaInicial(c: CadastroItemPersist): 'aprovado' | 'reprovado' | null {
  const r = c.resultadoPermanencia ?? c.resultadoNatacao;
  if (r === 'aprovado' || r === 'reprovado') return r;
  return null;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function dataNascimentoValida(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return false;
  return idadeFromDataNascimento(t) != null;
}

export function EditarResultadoTafModal({ visible, cadastro, onClose, onSalvo }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [tempoCorrida, setTempoCorrida] = useState('');
  const [tempoNatacao, setTempoNatacao] = useState('');
  const [permanencia, setPermanencia] = useState<'aprovado' | 'reprovado' | null>(null);
  const [dataNascimento, setDataNascimento] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible || !cadastro) return;
    setTempoCorrida(tempoParaExibicao(cadastro.tempoCorrida));
    setTempoNatacao(tempoParaExibicao(cadastro.tempoNatacao));
    setPermanencia(permanenciaInicial(cadastro));
    setDataNascimento((cadastro.dataNascimento || '').trim());
    setErro('');
    setSalvando(false);
  }, [visible, cadastro]);

  const idadePreview = useMemo(() => {
    const t = dataNascimento.trim();
    if (!t || !dataNascimentoValida(t)) return null;
    return idadeFromDataNascimento(t);
  }, [dataNascimento]);

  const fechar = useCallback(() => {
    if (salvando) return;
    onClose();
  }, [salvando, onClose]);

  const salvar = useCallback(async () => {
    if (!cadastro || salvando) return;
    if (!dataNascimentoValida(dataNascimento)) {
      setErro('Data de nascimento inválida. Use DD/MM/AAAA.');
      return;
    }
    if ((tempoCorrida.trim() || tempoNatacao.trim()) && !dataNascimento.trim()) {
      setErro('Informe a data de nascimento para calcular a nota da corrida/natação.');
      return;
    }
    const input: EdicaoResultadoTafInput = {
      tempoCorrida,
      tempoNatacao,
      permanencia,
    };
    setSalvando(true);
    setErro('');
    try {
      const base: CadastroItemPersist = {
        ...cadastro,
        dataNascimento: dataNascimento.trim(),
      };
      const atualizado = await salvarResultadosTafEditados(base, input);
      onSalvo(atualizado);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }, [
    cadastro,
    tempoCorrida,
    tempoNatacao,
    permanencia,
    dataNascimento,
    salvando,
    onSalvo,
    onClose,
  ]);

  if (!cadastro) return null;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={fechar}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: ui.modalBg, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Text style={[theme.textStyles.label, { color: ui.text }]}>Editar resultados</Text>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              onPress={fechar}
              style={styles.closeBtn}
              disabled={salvando}
            >
              <X size={18} color={ui.icon} strokeWidth={3} />
            </TouchableOpacity>
          </View>

          <Text style={[theme.textStyles.caption, styles.subtitle, { color: theme.textSecondary }]}>
            {cadastro.nome} · NIP {cadastro.nip}
          </Text>
          <Text style={[theme.textStyles.caption, styles.hint, { color: theme.textMuted }]}>
            Tempos em MM:SS. Deixe vazio para remover o resultado da modalidade.
          </Text>

          <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>
            Data de nascimento
          </Text>
          <TextInput
            value={dataNascimento}
            onChangeText={(t) => {
              setErro('');
              setDataNascimento(formatDateInput(t));
            }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={ui.placeholder}
            style={[
              styles.input,
              { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg },
            ]}
            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            maxLength={10}
            editable={!salvando}
          />
          {idadePreview != null ? (
            <Text
              style={[
                theme.textStyles.caption,
                { color: theme.gain, marginTop: -4, marginBottom: 8, fontWeight: '700' },
              ]}
            >
              Idade: {idadePreview} anos
            </Text>
          ) : !dataNascimento.trim() ? (
            <Text
              style={[
                theme.textStyles.caption,
                { color: theme.textMuted, marginTop: -4, marginBottom: 8 },
              ]}
            >
              Informe ou edite a data para calcular a nota corretamente.
            </Text>
          ) : null}

          <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>Corrida</Text>
          <TextInput
            value={tempoCorrida}
            onChangeText={(t) => {
              setErro('');
              setTempoCorrida(formatMinutosSegundosInput(t));
            }}
            placeholder="MM:SS"
            placeholderTextColor={ui.placeholder}
            style={[styles.input, { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg }]}
            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            maxLength={5}
            editable={!salvando}
          />

          <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>Natação</Text>
          <TextInput
            value={tempoNatacao}
            onChangeText={(t) => {
              setErro('');
              setTempoNatacao(formatMinutosSegundosInput(t));
            }}
            placeholder="MM:SS"
            placeholderTextColor={ui.placeholder}
            style={[styles.input, { borderColor: theme.border, color: ui.text, backgroundColor: theme.cardBg }]}
            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            maxLength={5}
            editable={!salvando}
          />

          <Text style={[theme.textStyles.label, styles.fieldLabel, { color: ui.text }]}>Permanência</Text>
          {(['aprovado', 'reprovado'] as const).map((opcao) => {
            const active = permanencia === opcao;
            return (
              <TouchableOpacity
                key={opcao}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setErro('');
                  setPermanencia(active ? null : opcao);
                }}
                style={styles.checkRow}
                activeOpacity={0.85}
                disabled={salvando}
              >
                <View style={[styles.checkBox, active ? styles.checkOn : styles.checkOff]}>
                  {active ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
                <Text style={[theme.textStyles.body, { color: ui.text }]}>
                  {opcao === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                </Text>
              </TouchableOpacity>
            );
          })}

          {erro ? (
            <Text style={[theme.textStyles.caption, styles.erro, { color: theme.loss }]}>{erro}</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={fechar}
              style={[styles.btn, styles.btnCancel, { borderColor: theme.border }]}
              disabled={salvando}
            >
              <Text style={[theme.textStyles.caption, { color: ui.text, fontWeight: '700' }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void salvar()}
              style={[styles.btn, styles.btnSave, { backgroundColor: theme.primary }]}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={theme.tokens.textOnPrimary} size="small" />
              ) : (
                <Text style={[theme.textStyles.caption, { color: theme.tokens.textOnPrimary, fontWeight: '800' }]}>
                  Salvar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    marginBottom: 6,
  },
  hint: {
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkOn: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkOff: {
    backgroundColor: 'transparent',
    borderColor: '#94A3B8',
  },
  erro: {
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnSave: {},
});
