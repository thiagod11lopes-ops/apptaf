import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Waves, Check } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatNipInput, nipDigitos } from '../../../utils/nipFormat';
import type { PreCadastroParticipante, PreCadastroTaf } from '../../../services/preCadastroTafStorage';

type Props = {
  preCadastro: PreCadastroTaf | null;
  onClose: () => void;
  onConfirm: (selecionados: PreCadastroParticipante[]) => void;
};

export function SelecaoNadadoresPreCadastroModal({
  preCadastro,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const visible = !!preCadastro;
  const participantes = preCadastro?.participantes ?? [];

  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!preCadastro) {
      setSelecionados(new Set());
      return;
    }
    // Por padrão nenhum marcado — o aplicador escolhe quem entra na bateria.
    setSelecionados(new Set());
  }, [preCadastro?.id]);

  const todosIds = useMemo(
    () => participantes.map((p, i) => `${nipDigitos(p.nip) || 'x'}:${i}`),
    [participantes],
  );

  const qtdSelecionada = selecionados.size;
  const todosMarcados =
    participantes.length > 0 && todosIds.every((id) => selecionados.has(id));

  const toggle = (key: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const marcarTodos = () => {
    setSelecionados(new Set(todosIds));
  };

  const limparSelecao = () => {
    setSelecionados(new Set());
  };

  const confirmar = () => {
    if (!preCadastro || qtdSelecionada < 1) return;
    const escolhidos = participantes.filter((_, i) =>
      selecionados.has(`${nipDigitos(participantes[i].nip) || 'x'}:${i}`),
    );
    onConfirm(escolhidos);
  };

  const footer = (
    <View style={styles.footerCol}>
      <Text style={[styles.footerHint, { color: theme.textMuted }]}>
        {qtdSelecionada === 0
          ? 'Selecione ao menos um nadador'
          : `${qtdSelecionada} de ${participantes.length} selecionado${qtdSelecionada !== 1 ? 's' : ''}`}
      </Text>
      <View style={styles.footerRow}>
        <PressableScale
          onPress={onClose}
          style={[styles.btnGhost, { borderColor: theme.border }]}
        >
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
        </PressableScale>
        <PressableScale
          onPress={confirmar}
          disabled={qtdSelecionada < 1}
          style={[styles.btnPrimaryOuter, { opacity: qtdSelecionada < 1 ? 0.45 : 1 }]}
        >
          <LinearGradient
            colors={[...t.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.btnPrimary,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)' } as object)
                : undefined,
            ]}
          >
            <Waves size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.btnPrimaryText}>Iniciar prova</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Quem vai nadar?"
      icon={<Waves size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      maxBodyHeight={480}
    >
      {preCadastro ? (
        <View style={styles.body}>
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            Marque os militares desta bateria. Os não selecionados permanecem no pré-cadastro.
          </Text>
          <View style={styles.toolbar}>
            <Pressable onPress={todosMarcados ? limparSelecao : marcarTodos} hitSlop={8}>
              <Text style={[styles.toolbarLink, { color: theme.primary }]}>
                {todosMarcados ? 'Limpar seleção' : 'Selecionar todos'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {participantes.map((p, index) => {
              const key = `${nipDigitos(p.nip) || 'x'}:${index}`;
              const marcado = selecionados.has(key);
              const nome = (p.nomeMilitar || '').trim() || `Participante ${index + 1}`;
              const nipFmt = formatNipInput(p.nip);
              return (
                <PressableScale
                  key={key}
                  onPress={() => toggle(key)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: marcado
                        ? theme.isDark
                          ? 'rgba(37,99,235,0.18)'
                          : 'rgba(37,99,235,0.08)'
                        : theme.cardBg,
                      borderColor: marcado ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      {
                        borderColor: marcado ? theme.primary : theme.border,
                        backgroundColor: marcado ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {marcado ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.nome, { color: theme.text }]} numberOfLines={2}>
                      {nome}
                    </Text>
                    {nipFmt ? (
                      <Text style={[styles.nip, { color: theme.textMuted }]}>NIP {nipFmt}</Text>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
    width: '100%',
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  toolbarLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontSize: 15,
    fontWeight: '700',
  },
  nip: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerCol: {
    width: '100%',
    gap: 8,
  },
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimaryOuter: {
    flex: 1.2,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
