import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, FileText, History, Search, Trash2, X } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import type { ResultadosTafPdfBloco } from '../../utils/resultadosTafPdfPorAplicador';
import type { ResultadoTafLinha } from '../../utils/resultadoTafCadastro';
import { valoresCorridaCaminhadaParaPdf } from '../../utils/corridaCaminhadaExcludente';
import { HistoricoResultadosSubstituidosModal } from './HistoricoResultadosSubstituidosModal';
import { HistoricoSubstituidoStripe } from './HistoricoSubstituidoStripe';
import { ConfirmacaoExcluirHistoricoSubstituidoModal } from './ConfirmacaoExcluirHistoricoSubstituidoModal';
import {
  excluirHistoricoProvaPreview,
  type HistoricoProvaPreviewItem,
} from '../../utils/resultadosAtuaisEHistoricosPreview';
import { nipDigitos } from '../../utils/nipFormat';

const ORANGE_BG = '#fff7ed';
const ORANGE_BORDER = '#f97316';
const ORANGE_TEXT = '#9a3412';
const ORANGE_MUTED = '#c2410c';

type Props = {
  visible: boolean;
  onClose: () => void;
  blocos: ResultadosTafPdfBloco[];
  /** Resultados anteriores (mesma prova, não são o último) — tarja + exclusão. */
  historicos?: HistoricoProvaPreviewItem[];
  subtitulo: string;
  salvando?: boolean;
  onHistoricoExcluido?: () => void | Promise<void>;
  /** Gera o PDF só com os blocos informados (já filtrados pela pesquisa, se houver). */
  onConfirmarSalvar: (blocosParaSalvar: ResultadosTafPdfBloco[], subtituloPdf: string) => void;
};

function celula(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t || '—';
}

function PreviewRow({
  linha,
  theme,
  onHistorico,
}: {
  linha: ResultadoTafLinha;
  theme: ReturnType<typeof useTheme>['theme'];
  onHistorico: (linha: ResultadoTafLinha) => void;
}) {
  const dist = valoresCorridaCaminhadaParaPdf(linha);
  const temCorrida =
    temValorResultado(dist.notaCorrida) || temValorResultado(dist.situacaoCorrida);
  const temCaminhada =
    temValorResultado(dist.notaCaminhada) || temValorResultado(dist.situacaoCaminhada);
  const temNatacao =
    temValorResultado(linha.notaNatacao) || temValorResultado(linha.situacaoNatacao);
  const temPermanencia =
    temValorResultado(linha.situacaoPermanencia) ||
    temValorResultado(linha.permanenciaTempo);
  const temFlexaoBarra =
    temValorResultado(linha.notaFlexaoBarra) || temValorResultado(linha.situacaoFlexaoBarra);
  const temFlexaoSolo =
    temValorResultado(linha.notaFlexaoSolo) || temValorResultado(linha.situacaoFlexaoSolo);
  const temAbdRemador =
    temValorResultado(linha.notaAbdominalRemador) ||
    temValorResultado(linha.situacaoAbdominalRemador);
  const temAbdPrancha =
    temValorResultado(linha.notaAbdominalPrancha) ||
    temValorResultado(linha.situacaoAbdominalPrancha);

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.nome, { color: theme.text }]} numberOfLines={2}>
            {celula(linha.nome)}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {celula(linha.postoGrad)} · NIP {celula(linha.nip)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onHistorico(linha)}
          style={[styles.histBtn, { borderColor: theme.border }]}
          accessibilityLabel={`Histórico substituído de ${linha.nome}`}
        >
          <History size={15} color={theme.primary} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {temCorrida ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Corrida: {celula(dist.notaCorrida)} · {celula(dist.situacaoCorrida)}
            {dist.tempoCorrida ? ` · ${dist.tempoCorrida}` : ''}
          </Text>
        ) : null}
        {temCaminhada ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Caminhada: {celula(dist.notaCaminhada)} · {celula(dist.situacaoCaminhada)}
            {dist.tempoCaminhada ? ` · ${dist.tempoCaminhada}` : ''}
          </Text>
        ) : null}
        {temNatacao ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Natação: {celula(linha.notaNatacao)} · {celula(linha.situacaoNatacao)}
            {linha.tempoNatacao ? ` · ${linha.tempoNatacao}` : ''}
          </Text>
        ) : null}
        {temPermanencia ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Permanência: {celula(linha.situacaoPermanencia)}
            {linha.permanenciaTempo && linha.permanenciaTempo !== '—'
              ? ` · ${linha.permanenciaTempo}`
              : ''}
          </Text>
        ) : null}
        {temFlexaoBarra ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Flexão barra: {celula(linha.notaFlexaoBarra)} · {celula(linha.situacaoFlexaoBarra)}
          </Text>
        ) : null}
        {temFlexaoSolo ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Flexão solo: {celula(linha.notaFlexaoSolo)} · {celula(linha.situacaoFlexaoSolo)}
          </Text>
        ) : null}
        {temAbdRemador ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Abdominal remador: {celula(linha.notaAbdominalRemador)} ·{' '}
            {celula(linha.situacaoAbdominalRemador)}
          </Text>
        ) : null}
        {temAbdPrancha ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Abdominal prancha: {celula(linha.notaAbdominalPrancha)} ·{' '}
            {celula(linha.situacaoAbdominalPrancha)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function isBuscaPorNip(busca: string): boolean {
  const raw = busca.trim();
  if (!raw) return false;
  const digits = nipDigitos(raw);
  if (digits.length < 2) return false;
  // NIP é só dígitos (com ou sem pontos/espaços) — não mistura com nome.
  return /^[\d.\s-]+$/.test(raw);
}

function temValorResultado(valor: string | undefined): boolean {
  const t = (valor || '').trim();
  return !!t && t !== '—';
}

/** Quantos resultados de prova (modalidades) a linha traz para o militar. */
function contarResultadosNaLinha(linha: ResultadoTafLinha): number {
  let n = 0;
  if (temValorResultado(linha.notaCorrida) || temValorResultado(linha.situacaoCorrida)) n += 1;
  if (temValorResultado(linha.notaCaminhada) || temValorResultado(linha.situacaoCaminhada)) n += 1;
  if (temValorResultado(linha.notaNatacao) || temValorResultado(linha.situacaoNatacao)) n += 1;
  if (
    temValorResultado(linha.situacaoPermanencia) ||
    temValorResultado(linha.permanenciaTempo)
  ) {
    n += 1;
  }
  if (temValorResultado(linha.notaFlexaoBarra) || temValorResultado(linha.situacaoFlexaoBarra)) {
    n += 1;
  }
  if (temValorResultado(linha.notaFlexaoSolo) || temValorResultado(linha.situacaoFlexaoSolo)) {
    n += 1;
  }
  if (
    temValorResultado(linha.notaAbdominalRemador) ||
    temValorResultado(linha.situacaoAbdominalRemador)
  ) {
    n += 1;
  }
  if (
    temValorResultado(linha.notaAbdominalPrancha) ||
    temValorResultado(linha.situacaoAbdominalPrancha)
  ) {
    n += 1;
  }
  return n;
}

function linhaCombinaBusca(
  linha: ResultadoTafLinha,
  q: string,
  qDigits: string,
  porNip: boolean,
): boolean {
  if (!q) return true;
  const nip = nipDigitos(linha.nip);
  if (porNip) {
    if (!qDigits || !nip) return false;
    // NIP completo: só o militar daquele NIP.
    if (qDigits.length >= 8) return nip === qDigits.slice(0, 8) || nip === qDigits;
    return nip.includes(qDigits);
  }
  const nome = (linha.nome || '').toLowerCase();
  const posto = (linha.postoGrad || '').toLowerCase();
  if (nome.includes(q) || posto.includes(q)) return true;
  // Nome pesquisado também aceita NIP digitado junto ao texto.
  if (qDigits.length >= 2 && nip.includes(qDigits)) return true;
  return false;
}

/** Filtra blocos do PDF pela pesquisa atual (NIP ou nome). Sem pesquisa → todos. */
export function filtrarBlocosPorBusca(
  blocos: ResultadosTafPdfBloco[],
  busca: string,
): ResultadosTafPdfBloco[] {
  const raw = busca.trim();
  if (!raw) {
    return blocos.map((bloco) => ({
      ...bloco,
      linhas: bloco.linhas.map((linha) => ({ ...linha })),
    }));
  }
  const q = raw.toLowerCase();
  const qDigits = nipDigitos(raw);
  const porNip = isBuscaPorNip(raw);
  return blocos
    .map((bloco) => ({
      rotuloAplicador: bloco.rotuloAplicador,
      aplicadorAssinatura: bloco.aplicadorAssinatura,
      linhas: bloco.linhas
        .filter((linha) => linhaCombinaBusca(linha, q, qDigits, porNip))
        .map((linha) => ({ ...linha })),
    }))
    .filter((bloco) => bloco.linhas.length > 0);
}

function montarSubtituloPdfFiltrado(
  subtitulo: string,
  busca: string,
  blocosFiltrados: ResultadosTafPdfBloco[],
): string {
  const base = (subtitulo || '').trim();
  const q = busca.trim();
  if (!q || blocosFiltrados.length === 0) return base;
  const linhas = blocosFiltrados.flatMap((b) => b.linhas);
  const nips = new Set(linhas.map((l) => nipDigitos(l.nip)).filter(Boolean));
  const porNip = isBuscaPorNip(q);
  if (porNip && nips.size === 1) {
    const nipFmt = (linhas[0]?.nip || q).trim();
    const nome = (linhas[0]?.nome || '').trim();
    const quem = nome && nome !== '—' ? `${nome} · NIP ${nipFmt}` : `NIP ${nipFmt}`;
    return base ? `${base} — ${quem}` : quem;
  }
  if (nips.size === 1) {
    const nipFmt = (linhas[0]?.nip || '').trim();
    const nome = (linhas[0]?.nome || q).trim();
    const quem = nipFmt ? `${nome} · NIP ${nipFmt}` : nome;
    return base ? `${base} — ${quem}` : quem;
  }
  return base ? `${base} — filtro: ${q}` : `Filtro: ${q}`;
}

export function SalvarArquivoCompletoPreviewModal({
  visible,
  onClose,
  blocos,
  historicos = [],
  subtitulo,
  salvando = false,
  onHistoricoExcluido,
  onConfirmarSalvar,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const ts = theme.textStyles;
  const [busca, setBusca] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [excluindoHistorico, setExcluindoHistorico] = useState(false);
  const [historicoParaExcluir, setHistoricoParaExcluir] =
    useState<HistoricoProvaPreviewItem | null>(null);
  const [focoHistorico, setFocoHistorico] = useState<{
    nip?: string;
    cadastroId?: string;
    nome?: string;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setBusca('');
      setHistoricoParaExcluir(null);
    }
  }, [visible]);

  const buscaRef = useRef(busca);
  const blocosRef = useRef(blocos);
  const subtituloRef = useRef(subtitulo);
  buscaRef.current = busca;
  blocosRef.current = blocos;
  subtituloRef.current = subtitulo;

  const buscaPorNip = useMemo(() => isBuscaPorNip(busca), [busca]);
  const temPesquisa = busca.trim().length > 0;

  const blocosFiltrados = useMemo(
    () => filtrarBlocosPorBusca(blocos, busca),
    [blocos, busca],
  );

  const historicosFiltrados = useMemo(() => {
    const raw = busca.trim();
    if (!raw) return historicos;
    const q = raw.toLowerCase();
    const qDigits = nipDigitos(raw);
    const porNip = isBuscaPorNip(raw);
    return historicos.filter((item) => {
      const nip = nipDigitos(item.nip);
      if (porNip) {
        if (!qDigits || !nip) return false;
        if (qDigits.length >= 8) return nip === qDigits.slice(0, 8) || nip === qDigits;
        return nip.includes(qDigits);
      }
      const nome = (item.nome || '').toLowerCase();
      const posto = (item.postoGrad || '').toLowerCase();
      if (nome.includes(q) || posto.includes(q)) return true;
      if (qDigits.length >= 2 && nip.includes(qDigits)) return true;
      return false;
    });
  }, [historicos, busca]);

  const resumoBusca = useMemo(() => {
    if (!busca.trim()) return null;
    const linhas = blocosFiltrados.flatMap((b) => b.linhas);
    const histQtd = historicosFiltrados.length;
    if (linhas.length === 0 && histQtd === 0) {
      return buscaPorNip
        ? 'Nenhum resultado encontrado para esse NIP.'
        : 'Nenhum militar encontrado para essa pesquisa.';
    }

    const porNip = new Map<string, ResultadoTafLinha[]>();
    for (const linha of linhas) {
      const key = nipDigitos(linha.nip) || linha.id;
      const list = porNip.get(key) ?? [];
      list.push(linha);
      porNip.set(key, list);
    }
    for (const h of historicosFiltrados) {
      const key = nipDigitos(h.nip) || h.id;
      if (!porNip.has(key)) porNip.set(key, []);
    }

    if (porNip.size === 1) {
      const militarLinhas = Array.from(porNip.values())[0] ?? [];
      const totalAtuais = militarLinhas.reduce(
        (acc, linha) => acc + contarResultadosNaLinha(linha),
        0,
      );
      const qtdAtuais = totalAtuais > 0 ? totalAtuais : militarLinhas.length;
      const nome =
        (militarLinhas[0]?.nome || historicosFiltrados[0]?.nome || '').trim();
      const nipFmt =
        (militarLinhas[0]?.nip || historicosFiltrados[0]?.nip || '').trim();
      const quem =
        nome && nome !== '—'
          ? nome
          : nipFmt
            ? `NIP ${nipFmt}`
            : 'esse militar';
      const partes: string[] = [];
      if (qtdAtuais > 0) {
        partes.push(
          `${qtdAtuais} resultado${qtdAtuais !== 1 ? 's' : ''} ${qtdAtuais !== 1 ? 'atuais' : 'atual'}`,
        );
      }
      if (histQtd > 0) {
        partes.push(
          `${histQtd} histórico${histQtd !== 1 ? 's' : ''}`,
        );
      }
      return `${partes.join(' · ')} para ${quem}`;
    }

    return `${porNip.size} militares encontrados`;
  }, [blocosFiltrados, historicosFiltrados, busca, buscaPorNip]);

  const abrirHistoricoGeral = useCallback(() => {
    setFocoHistorico(null);
    setHistoricoAberto(true);
  }, []);

  const abrirHistoricoMilitar = useCallback((linha: ResultadoTafLinha) => {
    setFocoHistorico({ nip: linha.nip, cadastroId: linha.id, nome: linha.nome });
    setHistoricoAberto(true);
  }, []);

  const executarExclusaoHistorico = useCallback(async () => {
    if (!historicoParaExcluir || excluindoHistorico) return;
    setExcluindoHistorico(true);
    try {
      await excluirHistoricoProvaPreview(historicoParaExcluir);
      setHistoricoParaExcluir(null);
      await onHistoricoExcluido?.();
    } finally {
      setExcluindoHistorico(false);
    }
  }, [historicoParaExcluir, excluindoHistorico, onHistoricoExcluido]);

  const subtituloPdf = useMemo(
    () => montarSubtituloPdfFiltrado(subtitulo, busca, blocosFiltrados),
    [subtitulo, busca, blocosFiltrados],
  );

  const confirmarSalvarFiltrado = useCallback(() => {
    // Recalcula no clique com a pesquisa atual — só o NIP/nome filtrado vai ao PDF.
    const filtrados = filtrarBlocosPorBusca(blocosRef.current, buscaRef.current);
    if (filtrados.length === 0) return;
    const sub = montarSubtituloPdfFiltrado(
      subtituloRef.current,
      buscaRef.current,
      filtrados,
    );
    onConfirmarSalvar(filtrados, sub);
  }, [onConfirmarSalvar]);

  const footer = (
    <View style={styles.footerCol}>
      <TouchableOpacity
        onPress={abrirHistoricoGeral}
        disabled={salvando}
        style={[styles.secondaryBtn, { borderColor: theme.border, opacity: salvando ? 0.55 : 1 }]}
        accessibilityLabel="Ver histórico de resultados substituídos"
      >
        <History size={16} color={theme.primary} strokeWidth={2.4} />
        <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
          Histórico de cada militar
        </Text>
      </TouchableOpacity>
      <View style={styles.footerRow}>
        <TouchableOpacity
          onPress={onClose}
          disabled={salvando}
          style={[styles.ghostBtn, { borderColor: theme.border, opacity: salvando ? 0.55 : 1 }]}
        >
          <Text style={[styles.ghostBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={confirmarSalvarFiltrado}
          disabled={salvando || blocosFiltrados.length === 0}
          activeOpacity={0.88}
          style={[
            styles.saveOuter,
            { opacity: salvando || blocosFiltrados.length === 0 ? 0.65 : 1 },
          ]}
          accessibilityLabel={
            busca.trim()
              ? 'Salvar PDF somente do militar ou filtro pesquisado'
              : 'Salvar PDF do arquivo completo'
          }
        >
          <LinearGradient
            colors={[...theme.tokens.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Download size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.saveBtnText}>
                  {temPesquisa ? 'Salvar PDF da pesquisa' : 'Salvar PDF'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      {temPesquisa && blocosFiltrados.length > 0 ? (
        <Text style={[styles.filtroHint, { color: theme.textMuted }]}>
          O PDF incluirá somente o que está na pesquisa atual.
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <ModernModal
        visible={visible}
        onClose={() => {
          if (!salvando) onClose();
        }}
        title="Pré-visualização do arquivo completo"
        icon={<FileText size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={footer}
        fullScreen
        dismissable={!salvando}
      >
        <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 10 }]}>
          {subtitulo}
        </Text>
        <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 12 }]}>
          Confira a tabela que será impressa no PDF. Use o histórico para ver resultados anteriores
          que foram substituídos.
        </Text>

        {blocos.length > 0 || historicos.length > 0 ? (
          <View
            style={[
              styles.buscaWrap,
              { backgroundColor: theme.cardBg, borderColor: ui.inputBorder },
            ]}
          >
            <Search size={16} color={theme.textMuted} strokeWidth={2.2} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Pesquisar por NIP ou nome do militar"
              placeholderTextColor={theme.textMuted}
              style={[styles.buscaInput, { color: ui.text }]}
              accessibilityLabel="Pesquisar por NIP ou nome do militar"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {busca.trim() ? (
              <TouchableOpacity
                onPress={() => setBusca('')}
                accessibilityLabel="Limpar pesquisa"
                hitSlop={8}
              >
                <X size={16} color={theme.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {resumoBusca ? (
          <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 10 }]}>
            {resumoBusca}
          </Text>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {blocos.length === 0 && historicos.length === 0 ? (
            <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Não há resultados para exportar.
            </Text>
          ) : null}

          {blocos.length > 0 && blocosFiltrados.length === 0 ? (
            <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Nenhum militar encontrado para essa pesquisa.
            </Text>
          ) : null}

          {blocosFiltrados.map((bloco, bi) => (
            <View key={`${bloco.rotuloAplicador}-${bi}`} style={styles.bloco}>
              <View
                style={[
                  styles.blocoHeader,
                  { backgroundColor: theme.primary + '18', borderColor: theme.primary + '44' },
                ]}
              >
                <Text style={[styles.blocoTitle, { color: theme.primary }]}>
                  {bloco.rotuloAplicador}
                </Text>
                <Text style={[ts.caption, { color: theme.textMuted }]}>
                  {bloco.linhas.length} militar{bloco.linhas.length !== 1 ? 'es' : ''}
                </Text>
              </View>
              {bloco.linhas.map((linha) => (
                <PreviewRow
                  key={`${bloco.rotuloAplicador}-${linha.id}-${linha.nip}`}
                  linha={linha}
                  theme={theme}
                  onHistorico={abrirHistoricoMilitar}
                />
              ))}
            </View>
          ))}

          {historicosFiltrados.length > 0 ? (
            <View style={styles.bloco}>
              <View style={[styles.blocoHeader, styles.historicoHeader]}>
                <Text style={[styles.blocoTitle, { color: ORANGE_TEXT }]}>
                  Resultados de histórico
                </Text>
                <Text style={[ts.caption, { color: ORANGE_MUTED }]}>
                  {historicosFiltrados.length} registro
                  {historicosFiltrados.length !== 1 ? 's' : ''} substituído
                  {historicosFiltrados.length !== 1 ? 's' : ''} · não entram no PDF
                </Text>
              </View>
              {historicosFiltrados.map((item) => (
                <View key={item.id} style={styles.historicoCard}>
                  <HistoricoSubstituidoStripe />
                  <View style={styles.historicoCardBody}>
                    <View style={styles.rowTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.nome, { color: ORANGE_TEXT }]} numberOfLines={2}>
                          {item.nome}
                        </Text>
                        <Text style={[styles.meta, { color: ORANGE_MUTED }]}>
                          {item.postoGrad ? `${item.postoGrad} · ` : ''}
                          NIP {item.nip} · {item.modalidadeLabel}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setHistoricoParaExcluir(item)}
                        disabled={excluindoHistorico}
                        accessibilityLabel={`Excluir histórico de ${item.modalidadeLabel}`}
                        style={styles.historicoDeleteBtn}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color="#c2410c" strokeWidth={2.3} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.cell, { color: ORANGE_TEXT }]}>
                      Nota: {item.nota} · Situação: {item.situacao}
                      {item.tempo && item.tempo !== '—' ? ` · Tempo: ${item.tempo}` : ''}
                    </Text>
                    <Text style={[styles.cell, { color: ORANGE_MUTED }]}>
                      Aplicado em {item.dataAplicacao}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </ModernModal>

      <HistoricoResultadosSubstituidosModal
        visible={historicoAberto}
        onClose={() => {
          setHistoricoAberto(false);
          setFocoHistorico(null);
          void onHistoricoExcluido?.();
        }}
        foco={focoHistorico}
        itensSessao={historicos}
        onItemExcluido={() => void onHistoricoExcluido?.()}
      />

      <ConfirmacaoExcluirHistoricoSubstituidoModal
        visible={historicoParaExcluir != null}
        nome={historicoParaExcluir?.nome ?? ''}
        nip={historicoParaExcluir?.nip ?? ''}
        modalidadeLabel={historicoParaExcluir?.modalidadeLabel ?? ''}
        loading={excluindoHistorico}
        onClose={() => {
          if (!excluindoHistorico) setHistoricoParaExcluir(null);
        }}
        onConfirm={() => void executarExclusaoHistorico()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  buscaInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  scroll: { flexGrow: 0, maxHeight: Platform.OS === 'web' ? 560 : 480 },
  scrollContent: { paddingBottom: 8, gap: 14 },
  bloco: { gap: 8 },
  blocoHeader: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  blocoTitle: { fontSize: 14, fontWeight: '800' },
  historicoHeader: {
    backgroundColor: '#ffedd5',
    borderColor: ORANGE_BORDER,
  },
  historicoCard: {
    borderWidth: 2,
    borderColor: ORANGE_BORDER,
    backgroundColor: ORANGE_BG,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 96,
  },
  historicoCardBody: {
    padding: 12,
    gap: 6,
    zIndex: 1,
  },
  historicoDeleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: ORANGE_BORDER,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nome: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  histBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: 3 },
  cell: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  footerCol: { width: '100%', gap: 10 },
  footerRow: { flexDirection: 'row', gap: 10, width: '100%' },
  filtroHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700' },
  saveOuter: { flex: 1.3, borderRadius: 12, overflow: 'hidden' },
  saveBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
