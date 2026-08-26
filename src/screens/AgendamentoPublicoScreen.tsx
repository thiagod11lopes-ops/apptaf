/**
 * Tela pública de agendamento do TAF.
 * Acessível em: https://thiagod11lopes-ops.github.io/apptaf/agendamento
 *
 * Fluxo:
 * 1. Lista de datas disponíveis
 * 2. Modalidades disponíveis na data selecionada
 * 3. Identificação do militar (NIP → busca cadastro)
 * 4. Confirmação da reserva
 * 5. Sucesso
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, QrCode, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import { PREMIUM } from '../theme/premium';
import { AgendamentoQrCodeModal } from '../components/home/AgendamentoQrCodeModal';
import {
  getAllSlots,
  MODALIDADE_AGENDAMENTO_LABELS,
  type ModalidadeAgendamento,
  type SlotAgendamento,
} from '../services/agendamentoStorage';
import {
  getReservasBySlot,
  getReservaMilitarNoSlot,
  saveReserva,
} from '../services/reservasAgendamentoStorage';
import { getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import { formatNomeComPosto } from '../utils/formatNomeComPosto';
import { dataBrParaIso } from '../utils/tafRegistro';
import { formatDataPresencaInput } from '../services/presencaTfmStorage';

type Etapa = 'data' | 'modalidade' | 'identificar' | 'cadastrar' | 'confirmar' | 'sucesso';

type SlotComVagas = SlotAgendamento & {
  reservados: number;
  disponiveis: number;
};

type DadosMilitar = {
  nip: string;
  nome: string;
  categoria?: string;
  oficial?: string;
  praca?: string;
  vinculo?: 'carreira' | 'rm2';
  isNovo?: boolean;
};

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function categoriasLabel(c: CadastroItemPersist): string {
  const cat = c.categoria === 'Oficiais' ? 'Oficial' : 'Praça';
  const posto = (c.oficial || c.praca || '').trim();
  const vinculo = c.vinculo === 'rm2' ? ' RM2' : '';
  return [posto + vinculo, cat].filter(Boolean).join(' · ');
}

const GRADUACOES_PRACAS = ['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO', 'SD'];
const POSTOS_OFICIAIS = ['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG', 'CALTE'];

export default function AgendamentoPublicoScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const navigation = useNavigation();

  const [carregando, setCarregando] = useState(true);
  const [slots, setSlots] = useState<SlotComVagas[]>([]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);

  const [etapa, setEtapa] = useState<Etapa>('data');
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [slotSelecionado, setSlotSelecionado] = useState<SlotComVagas | null>(null);
  const [militar, setMilitar] = useState<DadosMilitar | null>(null);

  // Identificação
  const [nip, setNip] = useState('');
  const [nipFeedback, setNipFeedback] = useState<string | null>(null);
  const [nipEncontrado, setNipEncontrado] = useState(false);
  const [nipNaoEncontrado, setNipNaoEncontrado] = useState(false);

  // Cadastro rápido
  const [novoNome, setNovoNome] = useState('');
  const [novaDtNasc, setNovaDtNasc] = useState('');
  const [novoSexo, setNovoSexo] = useState<'M' | 'F'>('M');
  const [novoCategoria, setNovoCategoria] = useState<'Oficiais' | 'Praças'>('Praças');
  const [novoPosto, setNovoPosto] = useState('MN');
  const [novoVinculo, setNovoVinculo] = useState<'carreira' | 'rm2'>('carreira');
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);

  // Confirmação
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [listaSlots, listaCadastros] = await Promise.all([
        getAllSlots(),
        getAllCadastros(),
      ]);
      setCadastros(listaCadastros);
      const com: SlotComVagas[] = await Promise.all(
        listaSlots.map(async (s) => {
          const reservas = await getReservasBySlot(s.id);
          return {
            ...s,
            reservados: reservas.length,
            disponiveis: Math.max(0, s.maxParticipantes - reservas.length),
          };
        }),
      );
      setSlots(com);
    } catch {
      setSlots([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Datas únicas com slots disponíveis
  const datas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const set = new Set<string>();
    for (const s of slots) {
      const iso = dataBrParaIso(s.data);
      if (iso && iso >= hoje && s.disponiveis > 0) set.add(s.data);
    }
    return Array.from(set).sort((a, b) =>
      (dataBrParaIso(a) ?? '').localeCompare(dataBrParaIso(b) ?? ''),
    );
  }, [slots]);

  // Slots da data selecionada
  const slotsData = useMemo(() => {
    if (!dataSelecionada) return [];
    return slots.filter((s) => s.data === dataSelecionada && s.disponiveis > 0);
  }, [slots, dataSelecionada]);

  const selecionarData = useCallback((d: string) => {
    setDataSelecionada(d);
    setEtapa('modalidade');
  }, []);

  const selecionarSlot = useCallback((s: SlotComVagas) => {
    setSlotSelecionado(s);
    setEtapa('identificar');
    setNip('');
    setNipFeedback(null);
    setNipEncontrado(false);
    setNipNaoEncontrado(false);
    setMilitar(null);
  }, []);

  const onChangeNip = useCallback(
    (text: string) => {
      const fmt = formatNipInput(text);
      setNip(fmt);
      setNipFeedback(null);
      setNipEncontrado(false);
      setNipNaoEncontrado(false);
      setMilitar(null);

      const key = nipDigitos(fmt);
      if (key.length < 8) return;

      const result = buscarCadastroPorNomeOuNip(cadastros, fmt);
      if (result.kind === 'found') {
        const c = result.cadastro;
        const nomeComPosto = formatNomeComPosto(c);
        setMilitar({
          nip: key,
          nome: nomeComPosto,
          categoria: c.categoria,
          oficial: c.oficial,
          praca: c.praca,
          vinculo: c.vinculo,
        });
        setNipEncontrado(true);
        setNipFeedback(`Militar encontrado: ${nomeComPosto}`);
      } else if (result.kind === 'ambiguous') {
        setNipFeedback('Múltiplos registros com este NIP. Verifique.');
      } else {
        setNipNaoEncontrado(true);
        setNipFeedback('NIP não encontrado no cadastro.');
        setNovoNome('');
        setNovaDtNasc('');
      }
    },
    [cadastros],
  );

  const avancarParaCadastro = useCallback(() => {
    setEtapa('cadastrar');
    setErroCadastro(null);
  }, []);

  const confirmarCadastroNovo = useCallback(async () => {
    const key = nipDigitos(nip);
    if (!novoNome.trim()) { setErroCadastro('Informe o nome completo.'); return; }
    if (!novaDtNasc.trim() || !dataBrParaIso(novaDtNasc)) {
      setErroCadastro('Informe a data de nascimento (DD/MM/AAAA).'); return;
    }

    try {
      const { addCadastro } = await import('../services/cadastrosIndexedDb');
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const novoCadastro: CadastroItemPersist = {
        id,
        nip: key,
        nome: novoNome.trim().toUpperCase(),
        dataNascimento: novaDtNasc.trim(),
        sexo: novoSexo,
        categoria: novoCategoria,
        oficial: novoCategoria === 'Oficiais' ? novoPosto : undefined,
        praca: novoCategoria === 'Praças' ? novoPosto : undefined,
        vinculo: novoVinculo,
      };
      await addCadastro(novoCadastro);
      const nomeComPosto = formatNomeComPosto(novoCadastro);
      setMilitar({
        nip: key,
        nome: nomeComPosto,
        categoria: novoCategoria,
        oficial: novoCategoria === 'Oficiais' ? novoPosto : undefined,
        praca: novoCategoria === 'Praças' ? novoPosto : undefined,
        vinculo: novoVinculo,
        isNovo: true,
      });
      setEtapa('confirmar');
    } catch {
      setErroCadastro('Erro ao cadastrar. Tente novamente.');
    }
  }, [nip, novoNome, novaDtNasc, novoSexo, novoCategoria, novoPosto, novoVinculo]);

  const avancarConfirmar = useCallback(async () => {
    if (!slotSelecionado || !militar) return;
    // Verifica se já tem reserva
    const existente = await getReservaMilitarNoSlot(militar.nip, slotSelecionado.id);
    if (existente) {
      setErroSalvar('Você já está inscrito nesta modalidade nesta data.');
      setEtapa('confirmar');
      return;
    }
    setEtapa('confirmar');
    setErroSalvar(null);
  }, [slotSelecionado, militar]);

  const confirmarReserva = useCallback(async () => {
    if (!slotSelecionado || !militar) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await saveReserva({
        slotId: slotSelecionado.id,
        data: slotSelecionado.data,
        modalidade: slotSelecionado.modalidade,
        nip: militar.nip,
        nome: militar.nome,
        categoria: militar.categoria,
        oficial: militar.oficial,
        praca: militar.praca,
        vinculo: militar.vinculo,
      });
      setEtapa('sucesso');
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Erro ao confirmar reserva.');
    } finally {
      setSalvando(false);
    }
  }, [slotSelecionado, militar]);

  const reiniciar = useCallback(() => {
    setEtapa('data');
    setDataSelecionada(null);
    setSlotSelecionado(null);
    setMilitar(null);
    setNip('');
    setNipFeedback(null);
    setNipEncontrado(false);
    setNipNaoEncontrado(false);
    void carregar();
  }, [carregar]);

  const voltar = useCallback(() => {
    if (etapa === 'modalidade') setEtapa('data');
    else if (etapa === 'identificar') setEtapa('modalidade');
    else if (etapa === 'cadastrar') setEtapa('identificar');
    else if (etapa === 'confirmar') setEtapa('identificar');
    else navigation.canGoBack() ? navigation.goBack() : reiniciar();
  }, [etapa, navigation, reiniciar]);

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.cardBg, borderColor: ui.inputBorder, color: ui.text },
  ];

  // ── Renderização por etapa ──────────────────────────────────────────────

  const renderData = () => (
    <View style={styles.etapaWrap}>
      <Text style={[ts.title, { color: ui.text, marginBottom: 6 }]}>
        Datas disponíveis
      </Text>
      <Text style={[ts.bodySecondary, { color: theme.textSecondary, marginBottom: 20 }]}>
        Selecione a data que deseja realizar o TAF.
      </Text>
      {datas.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <CalendarDays size={32} color={theme.textMuted} strokeWidth={1.8} />
          <Text style={[ts.body, { color: theme.textMuted, textAlign: 'center', marginTop: 10 }]}>
            Não há datas disponíveis no momento.{'\n'}Aguarde a abertura das inscrições.
          </Text>
        </View>
      ) : (
        datas.map((d) => {
          const slotsDaData = slots.filter((s) => s.data === d);
          const totalVagas = slotsDaData.reduce((acc, s) => acc + s.disponiveis, 0);
          const totalMod = slotsDaData.length;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => selecionarData(d)}
              style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              accessibilityLabel={`Selecionar data ${d}`}
            >
              <View style={styles.dataCardLeft}>
                <CalendarDays size={22} color={theme.primary} strokeWidth={2.2} />
                <View style={styles.dataCardTexts}>
                  <Text style={[ts.body, { color: ui.text, fontWeight: '700', fontSize: 18 }]}>
                    {d}
                  </Text>
                  <Text style={[ts.caption, { color: theme.textSecondary }]}>
                    {totalMod} modalidade{totalMod !== 1 ? 's' : ''} · {totalVagas} vaga{totalVagas !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const renderModalidade = () => (
    <View style={styles.etapaWrap}>
      <Text style={[ts.title, { color: ui.text, marginBottom: 4 }]}>Modalidades</Text>
      <Text style={[ts.bodySecondary, { color: theme.textSecondary, marginBottom: 20 }]}>
        {dataSelecionada} — Escolha a modalidade que irá realizar.
      </Text>
      {slotsData.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => selecionarSlot(s)}
          style={[
            styles.modalidadeCard,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
          accessibilityLabel={MODALIDADE_AGENDAMENTO_LABELS[s.modalidade]}
        >
          <View style={styles.modalidadeCardInfo}>
            <Text style={[ts.body, { color: ui.text, fontWeight: '700', fontSize: 16 }]}>
              {MODALIDADE_AGENDAMENTO_LABELS[s.modalidade]}
            </Text>
            <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 3 }]}>
              {s.disponiveis} vaga{s.disponiveis !== 1 ? 's' : ''} disponível
              {s.disponiveis !== 1 ? 'is' : ''} · máx. {s.maxParticipantes}
            </Text>
          </View>
          <View style={[styles.vagasBadge, { backgroundColor: s.disponiveis > 0 ? theme.gainMuted : theme.lossMuted }]}>
            <Text style={[ts.caption, { color: s.disponiveis > 0 ? theme.gain : theme.loss, fontWeight: '700' }]}>
              {s.disponiveis}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderIdentificar = () => (
    <View style={styles.etapaWrap}>
      <Text style={[ts.title, { color: ui.text, marginBottom: 4 }]}>Identificação</Text>
      <Text style={[ts.bodySecondary, { color: theme.textSecondary, marginBottom: 20 }]}>
        Informe seu NIP para verificar seu cadastro.
      </Text>

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>NIP</Text>
      <TextInput
        value={nip}
        onChangeText={onChangeNip}
        placeholder="00.0000.00"
        placeholderTextColor={theme.textMuted}
        keyboardType="number-pad"
        style={[inputStyle, { marginBottom: 12, fontSize: 20, textAlign: 'center', letterSpacing: 2 }]}
        accessibilityLabel="NIP do militar"
        autoFocus
      />

      {nipFeedback ? (
        <Text
          style={[
            ts.caption,
            {
              color: nipEncontrado ? theme.gain : nipNaoEncontrado ? theme.loss : theme.textSecondary,
              marginBottom: 12,
              textAlign: 'center',
              fontWeight: '600',
            },
          ]}
        >
          {nipFeedback}
        </Text>
      ) : null}

      {nipEncontrado && militar ? (
        <View style={[styles.militarCard, { backgroundColor: theme.cardBg, borderColor: theme.gain }]}>
          <User size={28} color={theme.primary} strokeWidth={2} />
          <View style={styles.militarCardTexts}>
            <Text style={[ts.body, { color: ui.text, fontWeight: '700', fontSize: 16 }]}>
              {militar.nome}
            </Text>
            <Text style={[ts.caption, { color: theme.textSecondary }]}>
              {categoriasLabel(militar as CadastroItemPersist)}
            </Text>
          </View>
        </View>
      ) : null}

      {nipNaoEncontrado ? (
        <TouchableOpacity
          onPress={avancarParaCadastro}
          style={[styles.btnSecundario, { borderColor: theme.primary }]}
          accessibilityLabel="Realizar cadastro"
        >
          <Text style={[ts.body, { color: theme.primary, fontWeight: '700' }]}>
            Não estou cadastrado — realizar cadastro
          </Text>
        </TouchableOpacity>
      ) : null}

      {nipEncontrado && militar ? (
        <TouchableOpacity
          onPress={() => void avancarConfirmar()}
          style={[styles.btnPrimario, { backgroundColor: theme.primary }]}
          accessibilityLabel="Continuar com esses dados"
        >
          <Text style={[ts.body, { color: '#fff', fontWeight: '700' }]}>Continuar</Text>
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderCadastrar = () => (
    <View style={styles.etapaWrap}>
      <Text style={[ts.title, { color: ui.text, marginBottom: 4 }]}>Cadastro</Text>
      <Text style={[ts.bodySecondary, { color: theme.textSecondary, marginBottom: 20 }]}>
        Preencha seus dados para participar do TAF.
      </Text>

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Nome completo</Text>
      <TextInput
        value={novoNome}
        onChangeText={(t) => { setNovoNome(t.toUpperCase()); setErroCadastro(null); }}
        placeholder="NOME COMPLETO"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="characters"
        style={[inputStyle, { marginBottom: 12 }]}
      />

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Data de nascimento</Text>
      <TextInput
        value={novaDtNasc}
        onChangeText={(t) => { setNovaDtNasc(formatDateInput(t)); setErroCadastro(null); }}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={theme.textMuted}
        keyboardType="number-pad"
        style={[inputStyle, { marginBottom: 12 }]}
      />

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Sexo</Text>
      <View style={[styles.toggleRow, { marginBottom: 12 }]}>
        {(['M', 'F'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setNovoSexo(s)}
            style={[
              styles.toggleBtn,
              { backgroundColor: novoSexo === s ? theme.primary : theme.cardBg, borderColor: novoSexo === s ? theme.primary : theme.border },
            ]}
          >
            <Text style={[ts.body, { color: novoSexo === s ? '#fff' : ui.text, fontWeight: '700' }]}>
              {s === 'M' ? 'Masculino' : 'Feminino'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Categoria</Text>
      <View style={[styles.toggleRow, { marginBottom: 12 }]}>
        {(['Praças', 'Oficiais'] as const).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => {
              setNovoCategoria(c);
              setNovoPosto(c === 'Praças' ? 'MN' : 'GM');
            }}
            style={[
              styles.toggleBtn,
              { backgroundColor: novoCategoria === c ? theme.primary : theme.cardBg, borderColor: novoCategoria === c ? theme.primary : theme.border },
            ]}
          >
            <Text style={[ts.body, { color: novoCategoria === c ? '#fff' : ui.text, fontWeight: '700' }]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Posto / Graduação</Text>
      <View style={[styles.chipRow, { marginBottom: 12 }]}>
        {(novoCategoria === 'Praças' ? GRADUACOES_PRACAS : POSTOS_OFICIAIS).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setNovoPosto(p)}
            style={[
              styles.chip,
              { backgroundColor: novoPosto === p ? theme.primary : theme.cardBg, borderColor: novoPosto === p ? theme.primary : theme.border },
            ]}
          >
            <Text style={[ts.caption, { color: novoPosto === p ? '#fff' : ui.text, fontWeight: '600' }]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Vínculo</Text>
      <View style={[styles.toggleRow, { marginBottom: 16 }]}>
        {([['carreira', 'Carreira'], ['rm2', 'RM2']] as const).map(([v, label]) => (
          <TouchableOpacity
            key={v}
            onPress={() => setNovoVinculo(v)}
            style={[
              styles.toggleBtn,
              { backgroundColor: novoVinculo === v ? theme.primary : theme.cardBg, borderColor: novoVinculo === v ? theme.primary : theme.border },
            ]}
          >
            <Text style={[ts.body, { color: novoVinculo === v ? '#fff' : ui.text, fontWeight: '700' }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {erroCadastro ? (
        <Text style={[ts.caption, { color: theme.error, marginBottom: 10, textAlign: 'center' }]}>
          {erroCadastro}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={() => void confirmarCadastroNovo()}
        style={[styles.btnPrimario, { backgroundColor: theme.primary }]}
        accessibilityLabel="Cadastrar e continuar"
      >
        <Text style={[ts.body, { color: '#fff', fontWeight: '700' }]}>Cadastrar e continuar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConfirmar = () => (
    <View style={styles.etapaWrap}>
      <Text style={[ts.title, { color: ui.text, marginBottom: 20 }]}>Confirmar inscrição</Text>

      {/* Slot */}
      <View style={[styles.resumoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 }]}>
          PROVA
        </Text>
        <Text style={[ts.body, { color: ui.text, fontWeight: '700', fontSize: 16 }]}>
          {slotSelecionado ? MODALIDADE_AGENDAMENTO_LABELS[slotSelecionado.modalidade] : '—'}
        </Text>
        <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>
          {slotSelecionado?.data ?? '—'}
        </Text>
      </View>

      {/* Militar */}
      <View style={[styles.resumoCard, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 10 }]}>
        <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 }]}>
          MILITAR
        </Text>
        <Text style={[ts.body, { color: ui.text, fontWeight: '700', fontSize: 16 }]}>
          {militar?.nome ?? '—'}
        </Text>
        <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>
          NIP {formatNipInput(militar?.nip ?? '')}
          {militar?.isNovo ? ' · Novo cadastro' : ''}
        </Text>
      </View>

      {erroSalvar ? (
        <Text style={[ts.caption, { color: theme.error, marginVertical: 10, textAlign: 'center' }]}>
          {erroSalvar}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={() => void confirmarReserva()}
        disabled={salvando}
        style={[
          styles.btnPrimario,
          { backgroundColor: salvando ? theme.textMuted : theme.gain, marginTop: 16 },
        ]}
        accessibilityLabel="Confirmar inscrição"
      >
        {salvando ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={[ts.body, { color: '#fff', fontWeight: '700', fontSize: 16 }]}>
            Confirmar inscrição
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSucesso = () => (
    <View style={[styles.etapaWrap, styles.sucessoWrap]}>
      <CheckCircle2 size={72} color={theme.gain} strokeWidth={1.8} />
      <Text style={[ts.title, { color: theme.gain, textAlign: 'center', marginTop: 20 }]}>
        Inscrição confirmada!
      </Text>
      <Text style={[ts.bodySecondary, { color: theme.textSecondary, textAlign: 'center', marginTop: 8 }]}>
        {militar?.nome}
      </Text>
      <Text style={[ts.body, { color: ui.text, textAlign: 'center', marginTop: 4 }]}>
        {slotSelecionado ? MODALIDADE_AGENDAMENTO_LABELS[slotSelecionado.modalidade] : ''} · {slotSelecionado?.data}
      </Text>
      <TouchableOpacity
        onPress={reiniciar}
        style={[styles.btnPrimario, { backgroundColor: theme.primary, marginTop: 32 }]}
        accessibilityLabel="Nova inscrição"
      >
        <Text style={[ts.body, { color: '#fff', fontWeight: '700' }]}>Nova inscrição</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={theme.isDark ? ['#0f172a', '#1e293b', '#0f172a'] : ['#f0f4f8', '#dde3ef', '#f0f4f8']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          {etapa !== 'data' && etapa !== 'sucesso' ? (
            <TouchableOpacity onPress={voltar} style={styles.backBtn} accessibilityLabel="Voltar">
              <ArrowLeft size={22} color={ui.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerTexts}>
            <View style={styles.titleRow}>
              <Text style={[ts.title, { color: ui.text, fontSize: 22, flexShrink: 1 }]}>
                Agendamento TAF
              </Text>
              <TouchableOpacity
                onPress={() => setQrModalVisible(true)}
                style={styles.qrIconBtn}
                accessibilityLabel="Gerar QR Code do agendamento"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <QrCode size={22} color="#b8941c" strokeWidth={2.3} />
              </TouchableOpacity>
            </View>
            <Text style={[ts.caption, { color: theme.textSecondary }]}>
              Inscreva-se na sua modalidade
            </Text>
          </View>
        </View>

        {/* Indicador de etapa */}
        {etapa !== 'sucesso' ? (
          <View style={styles.stepRow}>
            {(['data', 'modalidade', 'identificar', 'confirmar'] as Etapa[]).map((e, i) => {
              const etapas: Etapa[] = ['data', 'modalidade', 'identificar', 'cadastrar', 'confirmar', 'sucesso'];
              const atual = etapas.indexOf(etapa);
              const este = i;
              const ativo = este === (etapa === 'cadastrar' ? 2 : i === 2 && etapa === 'confirmar' ? 2 : i);
              const concluido = atual > (e === 'identificar' ? 2 : i);
              return (
                <View key={e} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    {
                      backgroundColor: concluido ? theme.gain : etapa === e || (e === 'identificar' && etapa === 'cadastrar') ? theme.primary : theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                    },
                  ]} />
                  {i < 3 ? <View style={[styles.stepLine, { backgroundColor: concluido ? theme.gain : theme.border }]} /> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Conteúdo */}
        {carregando ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[ts.bodySecondary, { color: theme.textSecondary, marginTop: 12 }]}>
              Carregando disponibilidade...
            </Text>
          </View>
        ) : (
          <>
            {etapa === 'data' && renderData()}
            {etapa === 'modalidade' && renderModalidade()}
            {etapa === 'identificar' && renderIdentificar()}
            {etapa === 'cadastrar' && renderCadastrar()}
            {etapa === 'confirmar' && renderConfirmar()}
            {etapa === 'sucesso' && renderSucesso()}
          </>
        )}
      </ScrollView>
      <AgendamentoQrCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepLine: { flex: 1, height: 2, marginHorizontal: 4 },
  etapaWrap: { gap: 0 },
  loadingWrap: { alignItems: 'center', marginTop: 60 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 32,
    alignItems: 'center',
    gap: 0,
  },
  dataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  dataCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  dataCardTexts: { flex: 1 },
  modalidadeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  modalidadeCardInfo: { flex: 1 },
  vagasBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 4,
  },
  fieldLabel: {
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 4,
  },
  militarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 16,
  },
  militarCardTexts: { flex: 1 },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: PREMIUM.radiusLg,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnSecundario: {
    borderWidth: 1.5,
    borderRadius: PREMIUM.radiusLg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  resumoCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sucessoWrap: {
    alignItems: 'center',
    paddingTop: 40,
  },
});
