import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, Check } from 'lucide-react-native';
import { ModernModal } from './sismav/ModernModal';
import { LabelNip } from './LabelNip';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addCadastro } from '../services/cadastrosIndexedDb';
import {
  analisarNipCadastro,
  cadastroTemErroNip,
  formatNipInput,
  NIP_FORMATO_LABEL,
  nipDigitos,
} from '../utils/nipFormat';

type Props = {
  visible: boolean;
  cadastros: CadastroItemPersist[];
  onClose: () => void;
  onCorrigido: (atualizado: CadastroItemPersist) => void;
};

function postoGradLabel(c: CadastroItemPersist): string {
  return c.categoria === 'Oficiais' ? c.oficial || '—' : c.praca || '—';
}

export function CorrigirNipCadastroModal({ visible, cadastros, onClose, onCorrigido }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const comErro = useMemo(
    () => cadastros.filter(cadastroTemErroNip),
    [cadastros],
  );

  useEffect(() => {
    if (!visible) return;
    const next: Record<string, string> = {};
    for (const c of comErro) {
      next[c.id] = c.nip ?? '';
    }
    setRascunhos(next);
    setErrosLinha({});
    setSalvandoId(null);
  }, [visible, comErro]);

  const alterarNip = useCallback((id: string, texto: string) => {
    setRascunhos((prev) => ({ ...prev, [id]: formatNipInput(texto) }));
    setErrosLinha((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const salvarLinha = useCallback(
    async (cadastro: CadastroItemPersist) => {
      const nipFinal = formatNipInput(rascunhos[cadastro.id] ?? '').trim();
      const analise = analisarNipCadastro(nipFinal);
      if (!analise.valido) {
        setErrosLinha((prev) => ({ ...prev, [cadastro.id]: analise.mensagem }));
        return;
      }

      const digitos = nipDigitos(nipFinal);
      const duplicado = cadastros.some(
        (c) => c.id !== cadastro.id && nipDigitos(c.nip ?? '') === digitos,
      );
      if (duplicado) {
        setErrosLinha((prev) => ({
          ...prev,
          [cadastro.id]: 'Este NIP já está cadastrado para outro militar.',
        }));
        return;
      }

      setSalvandoId(cadastro.id);
      setErrosLinha((prev) => {
        const next = { ...prev };
        delete next[cadastro.id];
        return next;
      });

      const atualizado: CadastroItemPersist = { ...cadastro, nip: analise.formatado };
      try {
        await addCadastro(atualizado);
        onCorrigido(atualizado);
      } catch {
        setErrosLinha((prev) => ({
          ...prev,
          [cadastro.id]: 'Não foi possível salvar. Tente novamente.',
        }));
      } finally {
        setSalvandoId(null);
      }
    },
    [cadastros, onCorrigido, rascunhos],
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Corrigir NIPs"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.5} />}
    >
      <Text style={[styles.resumo, { color: theme.textSecondary }]}>
        {comErro.length === 0
          ? 'Nenhum cadastro com erro de NIP.'
          : `${comErro.length} cadastro${comErro.length > 1 ? 's' : ''} com erro de NIP`}
      </Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        Formato esperado: {NIP_FORMATO_LABEL} (8 dígitos).
      </Text>

      {comErro.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
          <Check size={22} color={theme.gain} strokeWidth={2.5} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Todos os NIPs estão corretos.
          </Text>
        </View>
      ) : (
        comErro.map((c) => {
          const analise = analisarNipCadastro(c.nip ?? '');
          const erroMsg = errosLinha[c.id] ?? (!analise.valido ? analise.mensagem : '');
          const salvando = salvandoId === c.id;

          return (
            <View
              key={c.id}
              style={[styles.linha, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
            >
              <Text style={[styles.nome, { color: ui.text }]} numberOfLines={2}>
                {c.nome || '—'}
              </Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {postoGradLabel(c)} · NIP atual: {c.nip?.trim() || '—'}
              </Text>
              {!analise.valido && !errosLinha[c.id] ? (
                <Text style={[styles.erroAtual, { color: theme.loss }]}>{analise.mensagem}</Text>
              ) : null}

              <View style={styles.labelRow}>
                <LabelNip color={theme.textSecondary} fontSize={12} fontWeight="700" />
              </View>
              <TextInput
                value={rascunhos[c.id] ?? ''}
                onChangeText={(t) => alterarNip(c.id, t)}
                placeholder={NIP_FORMATO_LABEL}
                placeholderTextColor={ui.placeholder}
                style={[
                  styles.input,
                  {
                    borderColor: erroMsg ? theme.loss : theme.border,
                    color: ui.text,
                    backgroundColor: ui.inputBg,
                  },
                ]}
                keyboardType="numeric"
                autoCorrect={false}
                editable={!salvando}
                accessibilityLabel={`Corrigir NIP de ${c.nome}`}
              />
              {erroMsg ? <Text style={[styles.erroInput, { color: theme.loss }]}>{erroMsg}</Text> : null}

              <TouchableOpacity
                accessibilityLabel={`Salvar NIP de ${c.nome}`}
                disabled={salvando}
                onPress={() => void salvarLinha(c)}
                style={[
                  styles.btnSalvar,
                  { backgroundColor: salvando ? theme.border : theme.primary },
                ]}
              >
                {salvando ? (
                  <ActivityIndicator color={theme.text} size="small" />
                ) : (
                  <Text style={[styles.btnSalvarText, { color: theme.text }]}>Salvar correção</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  resumo: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  linha: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  nome: {
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
  },
  erroAtual: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelRow: {
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 14,
    fontWeight: '700',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  erroInput: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnSalvar: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSalvarText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
