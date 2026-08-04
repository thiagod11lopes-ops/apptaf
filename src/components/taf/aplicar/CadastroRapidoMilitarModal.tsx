import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, UserPlus } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';
import { AplicarTafInput } from './AplicarTafUi';
import { LabelNip } from '../../LabelNip';
import { addCadastro, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import { formatNipInput } from '../../../utils/nipFormat';
import { dataNascimentoCadastroValida } from '../../../utils/cadastroDadosTaf';
import { idadeFromDataNascimento } from '../../../utils/idadeFromDataNascimento';
import {
  VinculoCarreiraRm2Checks,
  type VinculoMilitar,
} from './VinculoCarreiraRm2Checks';

const POSTOS_OFICIAIS = ['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG', 'CALTE'] as const;
const GRADUACOES_PRACAS = ['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO'] as const;

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

type Etapa = 'aviso' | 'form';
type Categoria = 'Oficiais' | 'Praças';

type Props = {
  visible: boolean;
  nip: string;
  onClose: () => void;
  /** Chamado após persistir o cadastro; o pai confirma o participante na lista atual. */
  onCadastrado: (cadastro: CadastroItemPersist) => Promise<void>;
};

export function CadastroRapidoMilitarModal({ visible, nip, onClose, onCadastrado }: Props) {
  const { theme } = useTheme();
  const [etapa, setEtapa] = useState<Etapa>('aviso');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [vinculo, setVinculo] = useState<VinculoMilitar | null>(null);
  const [categoria, setCategoria] = useState<Categoria>('Praças');
  const [posto, setPosto] = useState<string>('MN');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const nipFmt = useMemo(() => formatNipInput(nip), [nip]);
  const idade = useMemo(() => idadeFromDataNascimento(dataNascimento), [dataNascimento]);

  useEffect(() => {
    if (!visible) return;
    setEtapa('aviso');
    setNome('');
    setDataNascimento('');
    setSexo('M');
    setVinculo(null);
    setCategoria('Praças');
    setPosto('MN');
    setErro('');
    setSalvando(false);
  }, [visible, nip]);

  const setCategoriaComPosto = (next: Categoria) => {
    setCategoria(next);
    setPosto(next === 'Oficiais' ? 'CT' : 'MN');
  };

  const fechar = () => {
    if (salvando) return;
    onClose();
  };

  const salvar = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro('Informe o nome do militar.');
      return;
    }
    if (!dataNascimentoCadastroValida(dataNascimento) || idade == null) {
      setErro('Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }
    if (vinculo !== 'carreira' && vinculo !== 'rm2') {
      setErro('Selecione Carreira ou RM2.');
      return;
    }
    if (!posto.trim()) {
      setErro(categoria === 'Oficiais' ? 'Selecione o posto.' : 'Selecione a graduação.');
      return;
    }

    const nipDigits = nipFmt.replace(/\D/g, '');
    if (nipDigits.length !== 8) {
      setErro('NIP inválido. Volte e informe 8 dígitos.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const cadastro: CadastroItemPersist = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        nip: nipFmt,
        nome: nomeTrim,
        dataNascimento: dataNascimento.trim(),
        sexo,
        vinculo,
        categoria,
        oficial: categoria === 'Oficiais' ? posto : undefined,
        praca: categoria === 'Praças' ? posto : undefined,
      };
      await addCadastro(cadastro);
      await onCadastrado(cadastro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar.');
      setSalvando(false);
      return;
    }
    setSalvando(false);
  };

  const opcoesPosto = categoria === 'Oficiais' ? POSTOS_OFICIAIS : GRADUACOES_PRACAS;

  const footerAviso = (
    <View style={styles.footer}>
      <PressableScale
        onPress={fechar}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Fechar</Text>
      </PressableScale>
      <PressableScale onPress={() => setEtapa('form')} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...theme.tokens.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnPrimary}
        >
          <UserPlus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.btnPrimaryText}>Cadastrar agora</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={fechar}
      fullScreen
      title={etapa === 'aviso' ? 'Militar não cadastrado' : 'Cadastrar militar'}
      icon={
        etapa === 'aviso' ? (
          <AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : (
          <UserPlus size={20} color="#FFFFFF" strokeWidth={2.2} />
        )
      }
      footer={etapa === 'aviso' ? footerAviso : undefined}
    >
      {etapa === 'aviso' ? (
        <View style={styles.body}>
          <Text style={[styles.msg, { color: theme.text }]}>
            Não há militar com o NIP <Text style={styles.strong}>{nipFmt || 'informado'}</Text> no
            cadastro.
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Você pode cadastrá-lo agora sem perder os demais participantes desta prova.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={[styles.label, styles.labelFirst, { color: theme.textMuted }]}>
            Categoria
          </Text>
          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['Oficiais', 'Praças'] as const).map((cat) => {
              const active = categoria === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoriaComPosto(cat)}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active
                        ? theme.isDark
                          ? 'rgba(37,99,235,0.35)'
                          : 'rgba(37,99,235,0.12)'
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>
            {categoria === 'Oficiais' ? 'Posto' : 'Graduação'}
          </Text>
          <View style={styles.chipsWrap}>
            {opcoesPosto.map((opt) => {
              const active = posto === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setPosto(opt)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active
                        ? theme.isDark
                          ? 'rgba(37,99,235,0.35)'
                          : 'rgba(37,99,235,0.12)'
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.nipLabelWrap}>
            <LabelNip color={theme.textMuted} fontSize={11} fontWeight="700" />
          </View>
          <AplicarTafInput
            value={nipFmt}
            editable={false}
            accessibilityLabel="NIP do militar"
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Nome</Text>
          <AplicarTafInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome completo"
            autoCapitalize="characters"
            accessibilityLabel="Nome do militar"
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Data de nascimento</Text>
          <View style={styles.dnRow}>
            <View style={styles.dnInput}>
              <AplicarTafInput
                value={dataNascimento}
                onChangeText={(t) => setDataNascimento(formatDateInput(t))}
                placeholder="DD/MM/AAAA"
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                inputMode="numeric"
                maxLength={10}
                accessibilityLabel="Data de nascimento"
              />
            </View>
            <VinculoCarreiraRm2Checks value={vinculo} onChange={setVinculo} />
          </View>
          <Text style={[styles.idadeHint, { color: theme.textSecondary }]}>
            {idade != null ? `Idade: ${idade} anos` : 'Necessária para calcular a nota'}
          </Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>Gênero</Text>
          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['M', 'F'] as const).map((sx) => {
              const active = sexo === sx;
              return (
                <TouchableOpacity
                  key={sx}
                  accessibilityLabel={sx === 'M' ? 'Masculino' : 'Feminino'}
                  onPress={() => setSexo(sx)}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active
                        ? theme.isDark
                          ? 'rgba(37,99,235,0.35)'
                          : 'rgba(37,99,235,0.12)'
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {sx === 'M' ? 'Masculino' : 'Feminino'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {erro ? <Text style={[styles.erro, { color: theme.error }]}>{erro}</Text> : null}

          <View style={styles.footerInline}>
            <PressableScale
              onPress={() => {
                if (salvando) return;
                setEtapa('aviso');
                setErro('');
              }}
              disabled={salvando}
              style={[styles.btnGhost, { borderColor: theme.border, opacity: salvando ? 0.5 : 1 }]}
            >
              <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Voltar</Text>
            </PressableScale>
            <PressableScale
              onPress={() => void salvar()}
              disabled={salvando}
              style={styles.btnPrimaryOuter}
            >
              <LinearGradient
                colors={[...theme.tokens.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnPrimary}
              >
                {salvando ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Salvar cadastro</Text>
                )}
              </LinearGradient>
            </PressableScale>
          </View>
        </View>
      )}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  msg: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  strong: { fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  labelFirst: {
    marginTop: 0,
  },
  nipLabelWrap: {
    marginTop: 6,
    height: 16,
    justifyContent: 'center',
  },
  idadeHint: { fontSize: 13, fontWeight: '600' },
  dnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dnInput: {
    flex: 1,
    minWidth: 0,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '800' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  erro: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  footer: { flexDirection: 'row', gap: 10, width: '100%' },
  footerInline: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 16,
    marginBottom: 8,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700' },
  btnPrimaryOuter: { flex: 1 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
