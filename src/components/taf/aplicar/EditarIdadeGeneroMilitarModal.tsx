import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserRound } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';
import { idadeFromDataNascimento } from '../../../utils/idadeFromDataNascimento';
import { dataNascimentoCadastroValida } from '../../../utils/cadastroDadosTaf';
import { AplicarTafInput } from './AplicarTafUi';
import { formatNipInput } from '../../../utils/nipFormat';
import {
  VinculoCarreiraRm2Checks,
  type VinculoMilitar,
} from './VinculoCarreiraRm2Checks';

const POSTOS_OFICIAIS = ['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG', 'CALTE'] as const;
const GRADUACOES_PRACAS_ARMADA = ['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO'] as const;
const GRADUACOES_PRACAS_CFN   = ['SD', 'CB', '3°SG', '2°SG', '1°SG', 'SO'] as const;
const CFN_COLOR = '#F59E0B';

type Categoria = 'Oficiais' | 'Praças';

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

export type EditarDadosMilitarPayload = {
  nome: string;
  normaTaf: 'armada' | 'cfn';
  categoria: Categoria;
  oficial?: string;
  praca?: string;
  dataNascimento: string;
  sexo: 'M' | 'F';
  vinculo: VinculoMilitar;
};

type Props = {
  visible: boolean;
  nip: string;
  nome: string;
  normaTaf?: 'armada' | 'cfn';
  categoria?: Categoria;
  postoGrad?: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
  /** Valor atual no cadastro (Carreira / RM2). */
  vinculo?: VinculoMilitar | null;
  onClose: () => void;
  onSalvar: (dados: EditarDadosMilitarPayload) => Promise<void>;
};

export function EditarIdadeGeneroMilitarModal({
  visible,
  nip,
  nome: nomeInicial,
  normaTaf: normaTafInicial,
  categoria: categoriaInicial,
  postoGrad: postoInicial,
  dataNascimento: dataInicial,
  sexo: sexoInicial,
  vinculo: vinculoInicial,
  onClose,
  onSalvar,
}: Props) {
  const { theme } = useTheme();
  const [normaTaf, setNormaTaf] = useState<'armada' | 'cfn'>(normaTafInicial ?? 'armada');
  const [nome, setNome] = useState(nomeInicial);
  const [categoria, setCategoria] = useState<Categoria>(
    categoriaInicial === 'Oficiais' ? 'Oficiais' : 'Praças',
  );
  const [posto, setPosto] = useState(postoInicial?.trim() || 'MN');
  const [dataNascimento, setDataNascimento] = useState(dataInicial);
  const [sexo, setSexo] = useState<'M' | 'F'>(sexoInicial === 'F' ? 'F' : 'M');
  const [vinculo, setVinculo] = useState<VinculoMilitar | null>(
    vinculoInicial === 'carreira' || vinculoInicial === 'rm2' ? vinculoInicial : null,
  );
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const norma: 'armada' | 'cfn' = normaTafInicial === 'cfn' ? 'cfn' : 'armada';
    setNormaTaf(norma);
    const cat: Categoria = categoriaInicial === 'Oficiais' ? 'Oficiais' : 'Praças';
    const pracasOpcoes = norma === 'cfn' ? GRADUACOES_PRACAS_CFN : GRADUACOES_PRACAS_ARMADA;
    const opcoes = cat === 'Oficiais' ? POSTOS_OFICIAIS : pracasOpcoes;
    const postoRaw = (postoInicial || '').trim();
    setNome((nomeInicial || '').trim());
    setCategoria(cat);
    setPosto(
      postoRaw && (opcoes as readonly string[]).includes(postoRaw)
        ? postoRaw
        : cat === 'Oficiais'
          ? 'CT'
          : norma === 'cfn' ? 'SD' : 'MN',
    );
    setDataNascimento(dataInicial);
    setSexo(sexoInicial === 'F' ? 'F' : 'M');
    setVinculo(vinculoInicial === 'carreira' || vinculoInicial === 'rm2' ? vinculoInicial : null);
    setErro('');
    setSalvando(false);
  }, [visible, nomeInicial, normaTafInicial, categoriaInicial, postoInicial, dataInicial, sexoInicial, vinculoInicial]);

  const idade = useMemo(() => idadeFromDataNascimento(dataNascimento), [dataNascimento]);
  const nipFmt = useMemo(() => formatNipInput(nip), [nip]);
  const graduacoesPracas = normaTaf === 'cfn' ? GRADUACOES_PRACAS_CFN : GRADUACOES_PRACAS_ARMADA;
  const opcoesPosto = categoria === 'Oficiais' ? POSTOS_OFICIAIS : graduacoesPracas;

  const setNormaTafComPosto = (next: 'armada' | 'cfn') => {
    if (categoria === 'Praças') {
      if (next === 'cfn' && posto === 'MN') setPosto('SD');
      else if (next === 'armada' && posto === 'SD') setPosto('MN');
    }
    setNormaTaf(next);
  };

  const setCategoriaComPosto = (next: Categoria) => {
    setCategoria(next);
    setPosto(next === 'Oficiais' ? 'CT' : normaTaf === 'cfn' ? 'SD' : 'MN');
  };

  const salvar = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro('Informe o nome do militar.');
      return;
    }
    const data = dataNascimento.trim();
    if (!dataNascimentoCadastroValida(data) || idade == null) {
      setErro('Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }
    if (!posto.trim()) {
      setErro(categoria === 'Oficiais' ? 'Selecione o posto.' : 'Selecione a graduação.');
      return;
    }
    if (vinculo !== 'carreira' && vinculo !== 'rm2') {
      setErro('Selecione Carreira ou RM2.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        nome: nomeTrim,
        normaTaf,
        categoria,
        oficial: categoria === 'Oficiais' ? posto : undefined,
        praca: categoria === 'Praças' ? posto : undefined,
        dataNascimento: data,
        sexo,
        vinculo,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setSalvando(false);
      return;
    }
    setSalvando(false);
  };

  return (
    <ModernModal
      visible={visible}
      onClose={() => {
        if (salvando) return;
        onClose();
      }}
      fullScreen
      title="Editar dados do militar"
      icon={<UserRound size={20} color="#FFFFFF" strokeWidth={2.2} />}
    >
      <View style={styles.body}>
        {nipFmt ? (
          <Text style={[styles.nip, { color: theme.textSecondary }]}>NIP {nipFmt}</Text>
        ) : null}

        <Text style={[styles.label, styles.labelFirst, { color: theme.textMuted }]}>Norma TAF</Text>
        <View style={[styles.segmented, { borderColor: theme.border }]}>
          {(['armada', 'cfn'] as const).map((n) => {
            const active = normaTaf === n;
            const cor = n === 'cfn' ? CFN_COLOR : theme.primary;
            return (
              <TouchableOpacity
                key={n}
                accessibilityLabel={n === 'cfn' ? 'CFN' : 'ARMADA'}
                onPress={() => setNormaTafComPosto(n)}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: active
                      ? theme.isDark ? cor + '40' : cor + '20'
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: active ? cor : theme.textSecondary }]}>
                  {n === 'cfn' ? 'CFN' : 'ARMADA'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Categoria</Text>
        <View style={[styles.segmented, { borderColor: theme.border }]}>
          {(['Oficiais', 'Praças'] as const).map((cat) => {
            const active = categoria === cat;
            return (
              <TouchableOpacity
                key={cat}
                accessibilityLabel={cat}
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
                accessibilityLabel={opt}
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
                  style={[styles.chipText, { color: active ? theme.primary : theme.textSecondary }]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Nome</Text>
        <AplicarTafInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome completo"
          autoCapitalize="words"
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
          {idade != null ? `Idade: ${idade} anos` : 'Informe a data para calcular a idade'}
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
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Os dados serão atualizados no cadastro e usados no cálculo da nota.
        </Text>

        <View style={styles.footerInline}>
          <PressableScale
            onPress={onClose}
            disabled={salvando}
            style={[styles.btnGhost, { borderColor: theme.border, opacity: salvando ? 0.5 : 1 }]}
          >
            <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
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
                <Text style={styles.btnPrimaryText}>Salvar</Text>
              )}
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  nip: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  labelFirst: { marginTop: 0 },
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
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  erro: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
